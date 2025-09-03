// app/api/orders/[id]/email/route.ts
export const runtime = 'nodejs';

import { prisma } from '@/lib/prisma';
import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { generateOrderPdfBuffer, type OrderLike as PdfOrderLike } from '@/lib/pdf';

// ===== Tipos =====
type CustomerLike = {
  id?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
};

type OrderItemLike = {
  name?: string;
  unit?: string | null;
  quantity?: number | string;
  unitPrice?: number | string;
  price?: number | string;
  total?: number | string;
  product?: { name?: string; unit?: string | null; price?: number | string } | null;
};

export type OrderLike = {
  id?: string;
  number?: number | string;
  customer?: CustomerLike | null;
  items?: OrderItemLike[];
  total?: number | string;
  createdAt?: string | number | Date;
  notes?: string | null;
};

type NormalizedItem = {
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

type NormalizedOrder = Omit<OrderLike, 'items' | 'total'> & {
  items: NormalizedItem[];
  total: number;
};

type EmailRequest = {
  to?: string;
  subject?: string;
  order?: OrderLike;
  attachPdf?: boolean;
};

type Ctx = { params: { id: string } } | { params: Promise<{ id: string }> };

// ===== Utils =====
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function pickEnv(...keys: string[]) {
  for (const k of keys) {
    const v = process.env[k];
    if (v && String(v).trim() !== '') return v;
  }
  return undefined;
}

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]);
}

function normalizeOrder(raw: OrderLike): NormalizedOrder {
  const itemsSrc = Array.isArray(raw?.items) ? raw.items : [];
  const items: NormalizedItem[] = itemsSrc.map((it) => {
    const quantity = Number(it?.quantity ?? it?.price /* old field? */ ?? 0); // fallback antigo se houver
    const unitPrice = Number(it?.unitPrice ?? it?.price ?? it?.product?.price ?? 0);
    const total = Number(it?.total ?? quantity * unitPrice);
    return {
      name: it?.name ?? it?.product?.name ?? '-',
      unit: (it?.unit ?? it?.product?.unit ?? '-') || '-',
      quantity: Number.isFinite(quantity) ? quantity : 0,
      unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
      total: Number.isFinite(total) ? total : 0,
    };
  });
  const computedTotal = items.reduce((acc, it) => acc + (Number.isFinite(it.total) ? it.total : 0), 0);
  return {
    ...raw,
    items,
    total: Number(raw?.total ?? computedTotal),
  };
}

function renderEmailSubject(order: OrderLike): string {
  const num = order?.number ?? '—';
  const cli = order?.customer?.name ? ` — ${order.customer.name}` : '';
  return `Pedido #${num}${cli}`;
}

function renderEmailText(orderLike: OrderLike): string {
  const order = normalizeOrder(orderLike);
  const linhas = order.items.map((it, i) => {
    return `${i + 1}. ${it.name} — ${it.quantity} ${it.unit || ''} x ${brl.format(it.unitPrice)} = ${brl.format(it.total)}`;
  });
  const phone = order.customer?.phone ? `Telefone: ${order.customer.phone}\n` : '';
  return [
    renderEmailSubject(order),
    '',
    `Cliente: ${order.customer?.name ?? '—'}`,
    order.customer?.email ? `E-mail: ${order.customer.email}` : null,
    phone || null,
    '',
    'Itens:',
    ...linhas,
    '',
    `Total: ${brl.format(Number(order.total || 0))}`,
    order.notes ? `Obs.: ${order.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function renderEmailHtml(orderLike: OrderLike): string {
  const order = normalizeOrder(orderLike);

  const rows =
    order.items
      .map(
        (it, i) => `
      <tr>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;">${i + 1}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;">${escapeHtml(it.name)}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:center;">${escapeHtml(it.unit)}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:right;">${it.quantity}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:right;">${brl.format(it.unitPrice)}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:right;font-weight:600;">${brl.format(it.total)}</td>
      </tr>`
      )
      .join('') ||
    `<tr><td colspan="6" style="padding:24px;text-align:center;color:#64748b;border:1px solid #e5e7eb;">— Sem itens —</td></tr>`;

  const phone = order.customer?.phone;
  const issuedAt = new Date(order.createdAt ?? Date.now()).toLocaleString('pt-BR');

  return `<!doctype html>
<html lang="pt-BR">
<head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;background:#f6f7f9;padding:24px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="padding:20px 24px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:18px;font-weight:700;">Pedido #${order.number ?? '—'}</div>
        <div style="font-size:12px;color:#64748b;">Emitido em ${issuedAt}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          <tr>
            <td style="width:50%;vertical-align:top;padding-right:12px;">
              <div style="font-size:12px;color:#64748b;margin-bottom:4px;">Cliente</div>
              <div style="font-weight:600;">${escapeHtml(order.customer?.name ?? '—')}</div>
              <div style="font-size:12px;color:#334155;margin-top:2px;display:flex;gap:8px;">
                ${order.customer?.email ? `<span>${escapeHtml(order.customer.email)}</span>` : ``}
                ${phone ? `<span style="color:#94a3b8;">•</span><span>${escapeHtml(phone)}</span>` : ``}
              </div>
            </td>
            <td style="width:50%;vertical-align:top;padding-left:12px;">
              <div style="font-size:12px;color:#64748b;margin-bottom:4px;">Observação</div>
              <div>${order.notes ? escapeHtml(order.notes) : '—'}</div>
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
          <tbody>${rows}</tbody>
          <tfoot>
            <tr>
              <td colspan="5" style="padding:10px;border:1px solid #e5e7eb;text-align:right;font-weight:700;">Total</td>
              <td style="padding:10px;border:1px solid #e5e7eb;text-align:right;font-weight:700;">${brl.format(Number(order.total || 0))}</td>
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

// ===== Mail Transporter =====
let cachedTransporter: nodemailer.Transporter | null = null;

async function buildTransporter(): Promise<nodemailer.Transporter> {
  if (cachedTransporter) return cachedTransporter;

  const GMAIL_SENDER_EMAIL = pickEnv('GMAIL_SENDER_EMAIL', 'GMAIL_SENDER');
  const GMAIL_CLIENT_ID = pickEnv('GMAIL_CLIENT_ID', 'GOOGLE_CLIENT_ID');
  const GMAIL_CLIENT_SECRET = pickEnv('GMAIL_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET');
  const GMAIL_REFRESH_TOKEN = pickEnv('GMAIL_REFRESH_TOKEN', 'GOOGLE_REFRESH_TOKEN');

  const hasGmail = Boolean(
    GMAIL_SENDER_EMAIL && GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && GMAIL_REFRESH_TOKEN
  );

  if (hasGmail) {
    const oAuth2Client = new google.auth.OAuth2(
      String(GMAIL_CLIENT_ID),
      String(GMAIL_CLIENT_SECRET)
      // redirectUri opcional para server-side
    );
    oAuth2Client.setCredentials({ refresh_token: String(GMAIL_REFRESH_TOKEN) });

    let accessToken: string | undefined;
    try {
      const r: unknown = await oAuth2Client.getAccessToken();
      if (typeof r === 'string') accessToken = r;
      else if (r && typeof r === 'object' && 'token' in r) {
        const tk = (r as { token?: string | null }).token;
        accessToken = tk ?? undefined;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('GMAIL_GET_ACCESS_TOKEN_FAIL', msg);
    }

    cachedTransporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        type: 'OAuth2',
        user: String(GMAIL_SENDER_EMAIL),
        clientId: String(GMAIL_CLIENT_ID),
        clientSecret: String(GMAIL_CLIENT_SECRET),
        refreshToken: String(GMAIL_REFRESH_TOKEN),
        accessToken,
      },
      logger: process.env.NODE_ENV !== 'production',
      debug: process.env.NODE_ENV !== 'production',
    });
    return cachedTransporter;
  }

  // Fallback SMTP
  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_PORT) === '465',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
    logger: process.env.NODE_ENV !== 'production',
    debug: process.env.NODE_ENV !== 'production',
  });
  return cachedTransporter;
}

// ===== Route =====
export async function POST(req: Request, ctx: Ctx) {
  try {
    const { id } = 'then' in ctx.params ? await ctx.params : ctx.params;

    let body: EmailRequest | undefined;
    try {
      body = (await req.json()) as EmailRequest;
    } catch {
      body = undefined;
    }

    const dbOrder = await prisma.order.findUnique({
      where: { id },
      include: { customer: true, items: true },
    });
    if (!dbOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const orderLike: OrderLike = body?.order ?? (dbOrder as unknown as OrderLike);
    const order = normalizeOrder(orderLike);

    const transporter = await buildTransporter();

    // (Opcional) verificação apenas em dev
    if (process.env.NODE_ENV !== 'production') {
      try {
        await transporter.verify();
      } catch (err: unknown) {
        const e = err as { code?: unknown; response?: unknown; responseCode?: unknown };
        console.error('MAILER_VERIFY_FAIL', e?.code, e?.response, e?.responseCode);
        return NextResponse.json(
          { error: 'Falha de autenticação no servidor de e-mail (verifique OAuth2 / token / escopo).' },
          { status: 500 }
        );
      }
    }

    const fromSmtp = process.env.SMTP_FROM;
    const gmailName = process.env.GMAIL_SENDER_NAME || 'Pedidos';
    const gmailEmail = pickEnv('GMAIL_SENDER_EMAIL', 'GMAIL_SENDER');
    const from = fromSmtp || (gmailEmail ? `"${gmailName}" <${gmailEmail}>` : 'no-reply@example.com');

    const to = body?.to || order.customer?.email || gmailEmail || fromSmtp;
    if (!to) {
      return NextResponse.json(
        { error: 'Destinatário ausente (sem e-mail do cliente e sem fallback)' },
        { status: 400 }
      );
    }

    const subject = body?.subject || renderEmailSubject(order);
    const text = renderEmailText(order);
    const html = renderEmailHtml(order);

    const attachments: nodemailer.Attachment[] = [];
    if (body?.attachPdf) {
      // compat: a tipagem do pdf aceita OrderLike – o lib/pdf já converte internamente
      const pdf = await generateOrderPdfBuffer(order as PdfOrderLike);
      attachments.push({
        filename: `pedido-${order.number ?? order.id}.pdf`,
        content: pdf,
        contentType: 'application/pdf',
      });
    }

    await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
      attachments: attachments.length ? attachments : undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Falha ao enviar e-mail';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
