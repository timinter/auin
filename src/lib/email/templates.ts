const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

function layout(body: string): string {
  const logoUrl = `${SITE_URL}/images/interexy-logo.png`;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; background-color: #f8f9fa;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width: 560px; width: 100%; background: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
          <!-- Logo -->
          <tr>
            <td style="padding: 32px 32px 16px; text-align: center; border-bottom: 1px solid #f0f0f0;">
              <img src="${logoUrl}" alt="SAMAP" height="32" style="height: 32px; width: auto;" />
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; font-size: 12px; color: #9ca3af; border-top: 1px solid #f0f0f0; text-align: center;">
              Interexy internal platform. Do not reply to this email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function notificationEmail(
  title: string,
  message: string,
  link?: string | null
): { subject: string; html: string } {
  let body = `
    <p style="margin: 0 0 8px; font-size: 18px; font-weight: 600; color: #111827;">${title}</p>
    <p style="margin: 0 0 24px; font-size: 14px; color: #4b5563;">${message}</p>`;
  if (link) {
    const fullUrl = link.startsWith("http") ? link : `${SITE_URL}${link}`;
    body += `<p style="margin: 0;"><a href="${fullUrl}" style="display: inline-block; padding: 10px 24px; background-color: #0f172a; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">View in SAMAP</a></p>`;
  }
  return { subject: `SAMAP: ${title}`, html: layout(body) };
}

const pStyle = 'style="margin: 0 0 16px; font-size: 14px; color: #4b5563;"';
const btnStyle = 'style="display: inline-block; padding: 10px 24px; background-color: #0f172a; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);"';

export function payrollReadyEmail(
  employeeName: string,
  period: string,
  link: string
): { subject: string; html: string } {
  const fullUrl = link.startsWith("http") ? link : `${SITE_URL}${link}`;
  const body = `
    <p ${pStyle}>Hi ${employeeName},</p>
    <p ${pStyle}>Your payroll for <strong>${period}</strong> is ready for review.</p>
    <p ${pStyle}>Please review and approve or reject it in SAMAP.</p>
    <p style="margin: 0;"><a href="${fullUrl}" ${btnStyle}>Review Payroll</a></p>
  `;
  return { subject: `SAMAP: Payroll ready for ${period}`, html: layout(body) };
}

export function invoiceStatusEmail(
  name: string,
  status: "approved" | "rejected",
  period: string,
  reason?: string | null
): { subject: string; html: string } {
  const label = status === "approved" ? "Approved" : "Rejected";
  let body = `
    <p ${pStyle}>Hi ${name},</p>
    <p ${pStyle}>Your invoice for <strong>${period}</strong> has been <strong>${label}</strong>.</p>
  `;
  if (status === "rejected" && reason) {
    body += `<p ${pStyle}>Reason: ${reason}</p>`;
  }
  return { subject: `SAMAP: Invoice ${status} for ${period}`, html: layout(body) };
}

export function compensationStatusEmail(
  name: string,
  category: string,
  status: "approved" | "rejected",
  amount?: number | null
): { subject: string; html: string } {
  let body = `
    <p ${pStyle}>Hi ${name},</p>
    <p ${pStyle}>Your <strong>${category}</strong> compensation request has been <strong>${status}</strong>.</p>
  `;
  if (status === "approved" && amount != null) {
    body += `<p ${pStyle}>Approved amount: <strong>$${amount.toFixed(2)}</strong></p>`;
  }
  return { subject: `SAMAP: ${category} compensation ${status}`, html: layout(body) };
}
