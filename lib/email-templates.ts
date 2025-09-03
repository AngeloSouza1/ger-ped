// lib/email-templates.ts
import type { OrderRow } from '@/app/(seu-caminho)/Page'; // ajuste o import se preciso

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function renderPedidoEmailSubject(o: OrderRow) {
  const num = o?.number ?? '—';
  const cliente = o?.customer?.name ?? 'Cliente';
  return `Pedido #${num} — ${cliente}`;
}

export function renderPedidoEmailText(o: OrderRow) {
  const linhas = (o.items ?? []).map((it: any, i: number) => {
    const q = Number(it.quantity || 0);
    const p = Number(it.unitPrice || 0);
    const t = Number(it.total ?? q * p);
    return `${i + 1}. ${it.name} — ${q} ${it.unit ?? ''}  x ${brl.format(p)}  = ${brl.format(t)}`;
  });

  return [
    renderPedidoEmailSubject(o),
    ``,
    `Cliente: ${o.customer?.name ?? '—'}`,
    o.customer?.email ? `E-mail: ${o.customer.email}` : null,
    (o as any).customer?.phone ? `Telefone: ${(o as any).customer.phone}` : null,
    ``,
    `Itens:`,
    ...linhas,
    ``,
    `Total: ${brl.format(Number(o.total || 0))}`,
    o.notes ? `Obs.: ${o.notes}` : null,
  ].filter(Boolean).join('\n');
}

export function renderPedidoEmailHtml(o: OrderRow) {
  const rows = (o.items ?? []).map((it: any, i: number) => {
    const q = Number(it.quantity || 0);
    const p = Number(it.unitPrice || 0);
    const t = Number(it.total ?? q * p);
    return `
      <tr>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;">${i + 1}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;">${it.name ?? '-'}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:center;">${it.unit ?? '-'}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:right;">${q}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:right;">${brl.format(p)}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:right;font-weight:600;">${brl.format(t)}</td>
      </tr>`;
  }).join('');

  const clientePhone = (o as any).customer?.phone;

  return `<!doctype html>
  <html lang="pt-BR">
    <head><meta charSet="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
    <body style="margin:0;background:#f6f7f9;padding:24px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:20px 24px;border-bottom:1px solid #e5e7eb;">
            <div style="font-size:18px;font-weight:700;">Pedido #${o.number ?? '—'}</div>
            <div style="font-size:12px;color:#64748b;">Emitido em ${new Date(o.createdAt ?? Date.now()).toLocaleString('pt-BR')}</div>
          </td>
        </tr>

        <tr>
          <td style="padding:16px 24px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
              <tr>
                <td style="width:50%;vertical-align:top;padding-right:12px;">
                  <div style="font-size:12px;color:#64748b;margin-bottom:4px;">Cliente</div>
                  <div style="font-weight:600;">${o.customer?.name ?? '—'}</div>
                  <div style="font-size:12px;color:#334155;margin-top:2px;display:flex;gap:8px;">
                    ${o.customer?.email ? `<span>${o.customer.email}</span>` : ``}
                    ${(clientePhone) ? `<span style="color:#94a3b8;">•</span><span>${clientePhone}</span>` : ``}
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
                  <td style="padding:10px;border:1px solid #e5e7eb;text-align:right;font-weight:700;">${brl.format(Number(o.total || 0))}</td>
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

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' } as any)[c]
  );
}
