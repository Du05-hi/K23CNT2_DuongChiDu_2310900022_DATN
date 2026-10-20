import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import passport from 'passport';
import { configureGoogleAuth } from './config/googleAuth';
import { configureSocket } from './config/socket';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { prisma } from './config/database';

dotenv.config();

const app = express();
const httpServer = createServer(app);
app.set('etag', false);

// Socket.io
export const io = configureSocket(httpServer);
app.set('io', io);

// Google OAuth
configureGoogleAuth();

// Middlewares
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(passport.initialize());

// Routes
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use('/api', routes);
app.get('/', (_req, res) => {
  res.status(200).json({ success: true, message: 'Server active' });
});
app.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date().toISOString() }));

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    const address = httpServer.address();
    const port = typeof address === 'object' && address ? address.port : PORT;
    console.log(`Server running at http://localhost:${port}`);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export default app;
