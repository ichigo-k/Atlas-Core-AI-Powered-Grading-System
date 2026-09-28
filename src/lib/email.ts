import nodemailer from "nodemailer"

const smtpUser = process.env.SMTP_USER
const smtpPass = process.env.SMTP_APP_PASSWORD

const transporter = smtpUser && smtpPass
  ? nodemailer.createTransport({
      service: "gmail",
      auth: { user: smtpUser, pass: smtpPass },
    })
  : null

const escapeHtml = (value: string) => value.replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[char] || char)

export function brandedEmail(title: string, body: string, cta?: { label: string; href: string }) {
  const safeBody = escapeHtml(body).replace(/\n/g, "<br />")
  return `<!doctype html><html><body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#172033"><div style="max-width:600px;margin:32px auto;background:#fff;border:1px solid #e3e8f0;border-radius:12px;overflow:hidden"><div style="background:#002388;padding:26px 32px;color:#fff"><div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;opacity:.8">GCTU Exam Portal</div><h1 style="margin:10px 0 0;font-size:24px;line-height:1.25">${escapeHtml(title)}</h1></div><div style="padding:32px;font-size:15px;line-height:1.7">${safeBody}${cta ? `<div style="margin-top:28px"><a href="${escapeHtml(cta.href)}" style="display:inline-block;background:#002388;color:#fff;text-decoration:none;padding:12px 20px;border-radius:7px;font-weight:bold">${escapeHtml(cta.label)}</a></div>` : ""}</div><div style="padding:18px 32px;background:#f8fafc;color:#64748b;font-size:12px">This is an automated message from Ghana Communication Technology University. Please do not reply to this email.</div></div></body></html>`
}

export async function sendEmail(to: string, subject: string, text: string, html?: string) {
  if (!transporter || !smtpUser) {
    console.warn("[sendEmail] SMTP is not configured; email skipped", { to, subject })
    return { sent: false, skipped: true }
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM || `GCTU Exam Portal <${smtpUser}>`,
    to,
    subject,
    text,
    html: html || brandedEmail(subject, text),
  })
  return { sent: true }
}

export async function sendEmailSafely(to: string | null | undefined, subject: string, text: string, html?: string) {
  if (!to) return
  try { await sendEmail(to, subject, text, html) }
  catch (error) { console.error("[sendEmailSafely] Email delivery failed", { to, subject, error: error instanceof Error ? error.message : String(error) }) }
}
