import nodemailer from "nodemailer"

let transporter: nodemailer.Transporter | null = null

export function getMailer(): nodemailer.Transporter {
  if (transporter) return transporter

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GOOGLE_SMTP_USER,
      pass: process.env.GOOGLE_SMTP_APP_PASSWORD,
    },
  })

  return transporter
}

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  await getMailer().sendMail({
    from: `"Lm3allem Terminal" <${process.env.GOOGLE_SMTP_USER}>`,
    to,
    subject,
    html,
  })
}