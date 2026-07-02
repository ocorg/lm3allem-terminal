export interface OverdueAlertData {
  clientName:          string
  clientPhone:         string
  kitReference:        string
  scheduledReturnDate: string
  daysOverdue:         number
}

export function overdueAlertHtml(data: OverdueAlertData): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#1a1a1a;padding:24px;border-radius:12px;">
      <div style="border-bottom:1px solid #333;padding-bottom:16px;margin-bottom:20px;">
        <h1 style="color:#F5A623;margin:0;font-size:18px;letter-spacing:0.05em;">
          LOCATION EN RETARD
        </h1>
        <p style="color:#8a8a8a;margin:6px 0 0;font-size:13px;">
          Alerte automatique - Lm3allem Terminal
        </p>
      </div>

      <table style="width:100%;border-collapse:collapse;">
        ${row("Client",           data.clientName)}
        ${row("Téléphone",        data.clientPhone)}
        ${row("Référence kit",    data.kitReference, "#F5A623")}
        ${row("Retour prévu",     data.scheduledReturnDate)}
        ${row("Retard",           `${data.daysOverdue} jour(s)`, "#C0392B", true)}
      </table>

      <div style="margin-top:24px;padding:12px;background:#252525;border-radius:8px;border-left:3px solid #C0392B;">
        <p style="color:#8a8a8a;font-size:12px;margin:0;">
          Cet email a été envoyé automatiquement par le système de gestion Lm3allem.
        </p>
      </div>
    </div>
  `
}

function row(
  label: string,
  value: string,
  valueColor = "#f5f5f5",
  bold = false
): string {
  return `
    <tr>
      <td style="padding:8px 0;color:#8a8a8a;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;width:40%;">
        ${label}
      </td>
      <td style="padding:8px 0;color:${valueColor};font-size:14px;${bold ? "font-weight:700;font-size:18px;" : ""}">
        ${value}
      </td>
    </tr>
  `
}