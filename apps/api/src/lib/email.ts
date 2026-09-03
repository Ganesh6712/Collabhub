import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

export async function getTransporter() {
  if (transporter) return transporter;

  // If SMTP credentials are provided in .env, use them
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    return transporter;
  }

  // Otherwise use Ethereal Email test account
  const testAccount = await nodemailer.createTestAccount();
  console.log("📧 Ethereal test account created:");
  console.log("   User:", testAccount.user);
  console.log("   Pass:", testAccount.pass);

  transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  return transporter;
}

export async function sendEmail(to: string, subject: string, html: string) {
  const t = await getTransporter();

  const info = await t.sendMail({
    from: process.env.FROM_EMAIL || '"CollabHub" <noreply@collabhub.com>',
    to,
    subject,
    html,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);

  console.log(`📧 Email sent to ${to}`);
  if (previewUrl) {
    console.log(`👁 Preview URL: ${previewUrl}`);
  }

  return { info, previewUrl };
}
