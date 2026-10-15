import nodemailer from 'nodemailer';

const getTransporter = () => {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error('SMTP_USER và SMTP_PASS cần được cấu hình để gửi email.');
  }

  const port = Number(process.env.SMTP_PORT || 465);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT không hợp lệ.');
  }

  return {
    transporter: nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: { user, pass },
    }),
    from: process.env.SMTP_FROM || user,
  };
};

export const sendOneTimeCodeEmail = async (
  email: string,
  code: string,
  purpose: 'REGISTER' | 'RESET_PASSWORD'
): Promise<void> => {
  const { transporter, from } = getTransporter();
  const isRegistration = purpose === 'REGISTER';

  await transporter.sendMail({
    from,
    to: email,
    subject: isRegistration ? 'Xác nhận tài khoản TaskFlow AI' : 'Mã đặt lại mật khẩu TaskFlow AI',
    text: `Mã xác nhận của bạn là ${code}. Mã có hiệu lực trong 5 phút. Nếu bạn không yêu cầu thao tác này, hãy bỏ qua email.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111827">
        <h2>${isRegistration ? 'Xác nhận tài khoản TaskFlow AI' : 'Đặt lại mật khẩu TaskFlow AI'}</h2>
        <p>${isRegistration ? 'Nhập mã sau để xác nhận địa chỉ email và kích hoạt tài khoản:' : 'Nhập mã sau để xác minh yêu cầu đặt lại mật khẩu:'}</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:8px">${code}</p>
        <p>Mã có hiệu lực trong 5 phút. Nếu bạn không yêu cầu thao tác này, hãy bỏ qua email.</p>
      </div>
    `,
  });
};
