export const getClientRedirectUrl = (
  path: string,
  query?: Record<string, string>
): URL => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const baseUrl = new URL(clientUrl.endsWith('/') ? clientUrl : `${clientUrl}/`);
  const redirectUrl = new URL(path.replace(/^\/+/, ''), baseUrl);

  for (const [key, value] of Object.entries(query || {})) {
    redirectUrl.searchParams.set(key, value);
  }

  return redirectUrl;
};
