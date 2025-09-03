// lib/pdf.ts
import puppeteer from 'puppeteer';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function renderOrderPrintHtml(o: any) {
  const rows = (o.items ?? []).map((it: any, i: number) => {
    const q = Number(it.quantity || 0);
    const p = Number(it.unitPrice || 0);
    const t = Number(it.total ?? q * p);
    return `
      <tr>
        <td class="c center">${i + 1}</td>
        <td class="c desc">${escapeHtml(it.name ?? '-')}</td>
        <td class="c center">${escapeHtml(it.unit ?? '-')}</td>
        <td class="c num">${q}</td>
        <td class="c num">${brl.format(p)}</td>
        <td class="c num">${brl.format(t)}</td>
      </tr>`;
  }).join('');

  const now = new Date(o.createdAt ?? Date.now()).toLocaleString('pt-BR');

  // IMPORTANTE: sem quebras 'forçadas' entre vias; se não couber, o navegador cria a 2ª página, mas não deixa página “em branco”.
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Pedido #${o.number ?? '—'}</title>
<style>
  @page { size: A4 portrait; margin: 8mm; }
  html, body { margin:0; padding:0; font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:#0f172a; }
  .sheet { padding: 0; }
  .copy { page-break-inside: avoid; margin: 0 0 8mm 0; }
  .copy:last-of-type { margin-bottom: 0; }
  .copy-header { display:flex; align-items:center; gap:10px; margin-bottom:6mm; }
  .copy-title { font-weight:700; font-size:16px; }
  .copy-sub { font-size:11px; color:#555; }
  .copy-badge { margin-left:auto; font-size:11px; border:1px solid #333; padding:2px 6px; border-radius:999px; }
  .copy-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px 12px; margin-bottom:6mm; }
  .copy-field label { display:block; font-size:10px; color:#555; }
  .copy-table { width:100%; border-collapse: collapse; font-size:12px; }
  .copy-table th, .copy-table td { border:1px solid #111; padding:6px; }
  .center { text-align:center; } .num { text-align:right; }
  .desc { max-width:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
  .tfoot th { font-weight:700; }
  .copy-footer { display:flex; align-items:center; gap:10mm; margin-top:6mm; }
  .sign-line { flex:1; border-top:1px dashed #111; text-align:center; padding-top:4mm; font-size:10px; }
  .cut { border:none; border-top:1px dashed #999; margin:8mm 0; }
</style>
</head>
<body>
  <div class="sheet">
    ${renderOne(o, '1ª via — Cliente', now)}
    <hr class="cut" />
    ${renderOne(o, '2ª via — Empresa (resumida)', now, /*minimal*/ true)}
  </div>
</body>
</html>`;
}

function renderOne(o: any, badge: string, when: string, minimal = false) {
  const rows = (o.items ?? []).map((it: any, i: number) => {
    const q = Number(it.quantity || 0);
    const p = Number(it.unitPrice || 0);
    const t = Number(it.total ?? q * p);
    return `
      <tr>
        <td class="center">${i + 1}</td>
        <td class="desc">${escapeHtml(it.name ?? '-')}</td>
        <td class="center">${escapeHtml(it.unit ?? '-')}</td>
        <td class="num">${q}</td>
        ${!minimal ? `<td class="num">${brl.format(p)}</td>` : ``}
        <td class="num">${brl.format(t)}</td>
      </tr>`;
  }).join('') || `<tr><td class="center" colspan="${minimal ? 5 : 6}" style="padding:10mm 0">— Sem itens —</td></tr>`;

  return `
  <div class="copy">
    <div class="copy-header">
      <div>
        <div class="copy-title">Emissão de pedidos</div>
        <div class="copy-sub">Pedido #${o.number ?? '—'} • Emitido em ${when}</div>
      </div>
      <div class="copy-badge">${badge}</div>
    </div>

    <div class="copy-grid">
      <div class="copy-field">
        <label>Cliente</label>
        <div>
          <div style="font-weight:700">${escapeHtml(o.customer?.name ?? '—')}</div>
          <div style="font-size:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            ${o.customer?.email ? `<span>${escapeHtml(o.customer.email)}</span>` : ``}
            ${o.customer?.phone ? `<span>•</span><span>${escapeHtml(o.customer.phone)}</span>` : ``}
          </div>
        </div>
      </div>
      <div class="copy-field">
        <label>Observação</label>
        <div>${o.notes ? escapeHtml(o.notes) : '—'}</div>
      </div>
    </div>

    <table class="copy-table">
      <thead>
        <tr>
          <th style="width:5%" class="center">#</th>
          <th>Descrição</th>
          <th style="width:10%" class="center">UN</th>
          <th style="width:${minimal ? '16%' : '12%'}" class="num">Qtd</th>
          ${!minimal ? `<th style="width:14%" class="num">Preço</th>` : ``}
          <th style="width:${minimal ? '22%' : '16%'}" class="num">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr class="tfoot">
          <th colspan="${minimal ? 4 : 5}" class="num">Total</th>
          <th class="num">${brl.format(Number(o.total || 0))}</th>
        </tr>
      </tfoot>
    </table>

    <div class="copy-footer">
      <div style="font-size:10px">Documento gerado eletronicamente. Válido como pedido de compra.</div>
      <div class="sign-line"><span>Assinatura / Carimbo</span></div>
    </div>
  </div>`;
}

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' } as any)[c]
  );
}

export async function generateOrderPdfBuffer(order: any) {
  const html = renderOrderPrintHtml(order);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' },
      preferCSSPageSize: true,
    });
    return pdf; // Buffer
  } finally {
    await browser.close();
  }
}
