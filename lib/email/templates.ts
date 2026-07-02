// ── Shared layout wrapper ──────────────────────────────────────
function base(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
</head>
<body style="margin:0;padding:24px;background:#F2F2F5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #E0E0E0;box-shadow:0 2px 8px rgba(0,0,0,0.07);">

    <!-- Header -->
    <div style="background:#D4941F;padding:22px 28px;">
      <p style="margin:0;color:rgba(255,255,255,0.7);font-size:11px;letter-spacing:0.1em;text-transform:uppercase;">Lm3allem Terminal</p>
      <h1 style="margin:5px 0 0;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.01em;">${title}</h1>
    </div>

    <!-- Body -->
    <div style="padding:28px 28px 24px;">
      ${body}
    </div>

    <!-- Footer -->
    <div style="padding:14px 28px;background:#F7F7FA;border-top:1px solid #EBEBEB;">
      <p style="margin:0;color:#AAAAAA;font-size:11px;">Lm3allem Terminal - Système interne. Ne pas répondre à cet email.</p>
    </div>

  </div>
</body>
</html>`
}

function row(label: string, value: string, bold = false): string {
  return `
  <tr>
    <td style="padding:7px 0;color:#888888;font-size:13px;width:45%;vertical-align:top;">${label}</td>
    <td style="padding:7px 0;font-size:13px;font-weight:${bold ? 700 : 400};color:${bold ? "#111111" : "#333333"};">${value}</td>
  </tr>`
}

// ── Rental confirmation ────────────────────────────────────────
export interface RentalConfirmationData {
  clientName:  string
  clientPhone: string
  kitRef:      string
  pickupDate:  string
  returnDate:  string
  totalAmount: string
  amountPaid:  string
  balance:     string
}

export function rentalConfirmationHtml(d: RentalConfirmationData): string {
  const body = `
    <table style="width:100%;border-collapse:collapse;">
      ${row("Client",          d.clientName,  true)}
      ${row("Téléphone",       d.clientPhone)}
      ${row("Référence kit",   d.kitRef,      true)}
      <tr><td colspan="2" style="padding:6px 0;border-bottom:1px solid #EBEBEB;"></td></tr>
      ${row("Date de retrait", d.pickupDate)}
      ${row("Date de retour",  d.returnDate)}
      <tr><td colspan="2" style="padding:6px 0;border-bottom:1px solid #EBEBEB;"></td></tr>
      ${row("Montant total",   d.totalAmount, true)}
      ${row("Payé",            d.amountPaid)}
    </table>
    <div style="margin-top:18px;padding:12px 16px;background:#FFF8EC;border-radius:6px;border-left:3px solid #D4941F;">
      <span style="font-size:13px;color:#333333;">Reste à payer : <strong>${d.balance}</strong></span>
    </div>`
  return base("Nouvelle location enregistrée", body)
}

// ── PIN delivery ───────────────────────────────────────────────
export interface PinDeliveryData {
  userName: string
  pin:      string
  action:   "created" | "reset"
}

export function pinDeliveryHtml(d: PinDeliveryData): string {
  const isNew = d.action === "created"
  const body = `
    <p style="margin:0 0 20px;font-size:14px;color:#333333;">
      ${isNew
        ? `Un nouveau compte a été créé pour <strong>${d.userName}</strong>.`
        : `Le PIN de <strong>${d.userName}</strong> a été réinitialisé.`}
    </p>
    <div style="background:#F4F4F7;border-radius:8px;padding:20px 24px;text-align:center;border:1px dashed #CCCCCC;">
      <p style="margin:0 0 6px;font-size:11px;color:#999999;letter-spacing:0.08em;text-transform:uppercase;">Code PIN</p>
      <p style="margin:0;font-size:34px;font-weight:800;letter-spacing:0.2em;color:#111111;">${d.pin}</p>
    </div>
    <p style="margin:16px 0 0;font-size:12px;color:#AAAAAA;">Transmettez ce PIN directement à l'utilisateur en main propre.</p>`
  return base(isNew ? "Nouveau compte créé" : "PIN réinitialisé", body)
}

// ── Low-stock digest ───────────────────────────────────────────
export interface LowStockDigestData {
  items: { name: string; portal: string; stock: number }[]
}

export function lowStockDigestHtml(d: LowStockDigestData): string {
  const tableRows = d.items.map(item => `
    <tr style="border-bottom:1px solid #EBEBEB;">
      <td style="padding:9px 0;font-size:13px;color:#333333;">${item.name}</td>
      <td style="padding:9px 0;font-size:12px;color:#888888;text-transform:capitalize;">${item.portal}</td>
      <td style="padding:9px 0;font-size:13px;font-weight:700;color:${item.stock === 0 ? "#E84040" : "#F0A030"};">
        ${item.stock === 0 ? "Épuisé" : `Stock: ${item.stock}`}
      </td>
    </tr>`).join("")

  const body = `
    <p style="margin:0 0 20px;font-size:14px;color:#333333;">
      <strong>${d.items.length} article${d.items.length > 1 ? "s" : ""}</strong>
      nécessite${d.items.length > 1 ? "nt" : ""} un réapprovisionnement.
    </p>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="border-bottom:2px solid #EBEBEB;">
          <th style="padding:8px 0;font-size:12px;color:#888888;text-align:left;font-weight:600;">Article</th>
          <th style="padding:8px 0;font-size:12px;color:#888888;text-align:left;font-weight:600;">Portail</th>
          <th style="padding:8px 0;font-size:12px;color:#888888;text-align:left;font-weight:600;">Statut</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>`
  return base("Digest - Stock bas", body)
}