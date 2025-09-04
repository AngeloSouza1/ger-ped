// lib/email-templates.ts

// Tipos mínimos para gerar e-mails (evita depender de Page.tsx)
export type EmailCustomer = {
  name?: string;
  email?: string | null;
  phone?: string | null;
};

export type EmailItem = {
  name?: string;
  unit?: string | null;
  quantity?: number | string | null;
  unitPrice?: number | string | null;
  total?: number | string | null;
};

export type EmailOrder = {
  number?: number | string;
  customer?: EmailCustomer | null;
  items?: EmailItem[];
  total?: number | string | null;
  notes?: string | null;
  createdAt?: string | Date | null;
};

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const toNumber = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const formatBRL = (v: unknown): string => brl.format(toNumber(v));

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch] ?? ch);
}

/* ---------- Assunto ---------- */
export function renderPedidoEmailSubject(o: EmailOrder): string {
  const num = o?.number ?? '—';
  const cliente = o?.customer?.name ?? 'Cliente';
  return `Pedido #${num} — ${cliente}`;
}

/* ---------- Texto simples ---------- */
export function renderPedidoEmailText(o: EmailOrder): string {
  const linhas = (o.items ?? []).map((it, i) => {
    const q = toNumber(it.quantity);
    const p = toNumber(it.unitPrice);
    const t = toNumber(it.total ?? q * p);
    const name = it.name ?? '-';
    const unit = it.unit ?? '';
    return `${i + 1}. ${name} — ${q} ${unit}  x ${formatBRL(p)}  = ${formatBRL(t)}`;
  });

  const parts = [
    renderPedidoEmailSubject(o),
    '',
    `Cliente: ${o.customer?.name ?? '—'}`,
    o.customer?.email ? `E-mail: ${o.customer.email}` : null,
    o.customer?.phone ? `Telefone: ${o.customer.phone}` : null,
    '',
    'Itens:',
    ...linhas,
    '',
    `Total: ${formatBRL(o.total)}`,
    o.notes ? `Obs.: ${o.notes}` : null,
  ];

  return parts.filter((x): x is string => Boolean(x)).join('\n');
}

/* ---------- HTML ---------- */
export function renderPedidoEmailHtml(o: EmailOrder): string {
  const rows = (o.items ?? [])
    .map((it, i) => {
      const q = toNumber(it.quantity);
      const p = toNumber(it.unitPrice);
      const t = toNumber(it.total ?? q * p);
      const name = escapeHtml(it.name ?? '-');
      const unit = escapeHtml(it.unit ?? '-');

      return `
        <tr>
          <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:center;">${i + 1}</td>
          <td style="padding:8px 10px;border:1px solid #e5e7eb;">${name}</td>
          <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:center;">${unit}</td>
          <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:right;">${q}</td>
          <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:right;">${formatBRL(p)}</td>
          <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:right;font-weight:600;">${formatBRL(t)}</td>
        </tr>`;
    })
    .join('');

  const issuedAt = (() => {
    const d = o.createdAt instanceof Date ? o.createdAt : o.createdAt ? new Date(o.createdAt) : new Date();
    return d.toLocaleString('pt-BR');
  })();

  const clienteName = escapeHtml(o.customer?.name ?? '—');
  const clienteEmail = o.customer?.email ? escapeHtml(o.customer.email) : '';
  const clientePhone = o.customer?.phone ? escapeHtml(o.customer.phone) : '';

  return `<!doctype html>
  <html lang="pt-BR">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1"/>
      <title>${escapeHtml(renderPedidoEmailSubject(o))}</title>
    </head>
    <body style="margin:0;background:#f6f7f9;padding:24px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:20px 24px;border-bottom:1px solid #e5e7eb;">
            <div style="font-size:18px;font-weight:700;">Pedido #${escapeHtml(String(o.number ?? '—'))}</div>
            <div style="font-size:12px;color:#64748b;">Emitido em ${escapeHtml(issuedAt)}</div>
          </td>
        </tr>

        <tr>
          <td style="padding:16px 24px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
              <tr>
                <td style="width:50%;vertical-align:top;padding-right:12px;">
                  <div style="font-size:12px;color:#64748b;margin-bottom:4px;">Cliente</div>
                  <div style="font-weight:600;">${clienteName}</div>
                  <div style="font-size:12px;color:#334155;margin-top:2px;display:flex;gap:8px;">
                    ${clienteEmail ? `<span>${clienteEmail}</span>` : ``}
                    ${clienteEmail && clientePhone ? `<span style="color:#94a3b8;">•</span>` : ``}
                    ${clientePhone ? `<span>${clientePhone}</span>` : ``}
                  </div>
                </td>
                <td style="width:50%;vertical-align:top;padding-left:12px;">
                  <div style="font-size:12px;color:#64748b;margin-bottom:4px;">Observação</div>
                  <div>${o.notes ? escapeHtml(o.notes) : '—'}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:0 24px 16px;">
            <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
              <thead>
                <tr style="background:#f8fafc;color:#0f172a;">
                  <th style="padding:10px;border:1px solid #e5e7eb;text-align:left;">#</th>
                  <th style="padding:10px;border:1px solid #e5e7eb;text-align:left;">Descrição</th>
                  <th style="padding:10px;border:1px solid #e5e7eb;text-align:center;">UN</th>
                  <th style="padding:10px;border:1px solid #e5e7eb;text-align:right;">Qtd</th>
                  <th style="padding:10px;border:1px solid #e5e7eb;text-align:right;">Preço</th>
                  <th style="padding:10px;border:1px solid #e5e7eb;text-align:right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${rows || `<tr><td colspan="6" style="padding:24px;text-align:center;color:#64748b;border:1px solid #e5e7eb;">— Sem itens —</td></tr>`}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="5" style="padding:10px;border:1px solid #e5e7eb;text-align:right;font-weight:700;">Total</td>
                  <td style="padding:10px;border:1px solid #e5e7eb;text-align:right;font-weight:700;">${formatBRL(o.total)}</td>
                </tr>
              </tfoot>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:16px 24px;color:#64748b;font-size:12px;border-top:1px solid #e5e7eb;">
            Documento gerado eletronicamente. Válido como pedido de compra.
          </td>
        </tr>
      </table>
    </body>
  </html>`;
}
