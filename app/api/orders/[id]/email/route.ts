// app/api/orders/[id]/email/route.ts
import { prisma } from '@/lib/prisma';
import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { generateOrderPdfBuffer } from '@/lib/pdf';

export const runtime = 'nodejs'; // garante Node (Nodemailer/Google APIs precisam)

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function pickEnv(...keys: string[]) {
  for (const k of keys) {
    const v = process.env[k];
    if (v && String(v).trim() !== '') return v;
  }
  return undefined;
}

// cache simples p/ não recriar a cada request
let cachedTransporter: nodemailer.Transporter | null = null;

/** Preferência: Gmail OAuth2 -> fallback SMTP tradicional */
async function buildTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const GMAIL_SENDER_EMAIL  = pickEnv('GMAIL_SENDER_EMAIL', 'GMAIL_SENDER');
  const GMAIL_CLIENT_ID     = pickEnv('GMAIL_CLIENT_ID', 'GOOGLE_CLIENT_ID');
  const GMAIL_CLIENT_SECRET = pickEnv('GMAIL_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET');
  const GMAIL_REFRESH_TOKEN = pickEnv('GMAIL_REFRESH_TOKEN', 'GOOGLE_REFRESH_TOKEN');

  const hasGmail = GMAIL_SENDER_EMAIL && GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && GMAIL_REFRESH_TOKEN;

  if (hasGmail) {
    // gera accessToken explicitamente (mais estável)
    const oAuth2Client = new google.auth.OAuth2(String(GMAIL_CLIENT_ID), String(GMAIL_CLIENT_SECRET));
    oAuth2Client.setCredentials({ refresh_token: String(GMAIL_REFRESH_TOKEN) });

    let accessToken: string | undefined;
    try {
      const r = await oAuth2Client.getAccessToken();
      accessToken = typeof r === 'string' ? r : r?.token ?? undefined;
    } catch (e: any) {
      console.error('GMAIL_GET_ACCESS_TOKEN_FAIL', e?.message);
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
      // deixe logger/debug desligados em prod para menos ruído
      logger: process.env.NODE_ENV !== 'production',
      debug : process.env.NODE_ENV !== 'production',
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
    debug : process.env.NODE_ENV !== 'production',
  });
  return cachedTransporter;
}

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c]);
}

function renderEmailSubject(order: any) {
  const num = order?.number ?? '—';
  const cli = order?.customer?.name ? ` — ${order.customer.name}` : '';
  return `Pedido #${num}${cli}`;
}

function renderEmailText(order: any) {
  const linhas = (order.items ?? []).map((it: any, i: number) => {
    const q = Number(it.quantity || it.qty || 0);
    const p = Number(it.unitPrice || it.price || 0);
    const t = Number(it.total ?? q * p);
    return `${i + 1}. ${it.name ?? '-'} — ${q} ${it.unit ?? ''} x ${brl.format(p)} = ${brl.format(t)}`;
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
  ].filter(Boolean).join('\n');
}

function renderEmailHtml(order: any) {
  const rows = (order.items ?? []).map((it: any, i: number) => {
    const q = Number(it.quantity || it.qty || 0);
    const p = Number(it.unitPrice || it.price || 0);
    const t = Number(it.total ?? q * p);
    return `
      <tr>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;">${i + 1}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;">${escapeHtml(it.name ?? '-')}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:center;">${escapeHtml(it.unit ?? '-')}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:right;">${q}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:right;">${brl.format(p)}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:right;font-weight:600;">${brl.format(t)}</td>
      </tr>`;
  }).join('');

  const phone = order.customer?.phone;

  return `<!doctype html>
<html lang="pt-BR">
<head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;background:#f6f7f9;padding:24px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="padding:20px 24px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:18px;font-weight:700;">Pedido #${order.number ?? '—'}</div>
        <div style="font-size:12px;color:#64748b;">Emitido em ${new Date(order.createdAt ?? Date.now()).toLocaleString('pt-BR')}</div>
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
          <tbody>
            ${rows || `<tr><td colspan="6" style="padding:24px;text-align:center;color:#64748b;border:1px solid #e5e7eb;">— Sem itens —</td></tr>`}
          </tbody>
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

/** Normaliza shape do pedido */
function normalizeOrder(o: any) {
  if (!o) return o;
  const items = (o.items ?? []).map((it: any) => {
    const quantity  = Number(it.quantity ?? it.qty ?? 0);
    const unitPrice = Number(it.unitPrice ?? it.price ?? 0);
    const total     = Number(it.total ?? quantity * unitPrice);
    return {
      name: it.name ?? it.product?.name ?? '-',
      unit: it.unit ?? it.product?.unit ?? '-',
      quantity,
      unitPrice,
      total,
    };
  });
  const total = items.reduce((acc: number, it: any) => acc + Number(it.total || 0), 0);
  return { ...o, items, total: Number(o.total ?? total) };
}

// --- IMPORTANTE: compatível com Next 15 (params pode ser Promise)
type Ctx = { params: { id: string } } | { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { id } = 'then' in ctx.params ? await ctx.params : ctx.params;

    let body: any = {};
    try { body = await req.json(); } catch {}

    const dbOrder = await prisma.order.findUnique({
      where: { id },
      include: { customer: true, items: true },
    });
    if (!dbOrder) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const order = normalizeOrder(body?.order ?? dbOrder);

    const transporter = await buildTransporter();

    // verificação só em dev para não atrasar em prod
    if (process.env.NODE_ENV !== 'production') {
      try {
        await transporter.verify();
      } catch (e: any) {
        console.error('MAILER_VERIFY_FAIL', e?.code, e?.response, e?.responseCode);
        return NextResponse.json(
          { error: 'Falha de autenticação no servidor de e-mail (verifique OAuth2 / token / escopo).' },
          { status: 500 },
        );
      }
    }

    const fromSmtp  = process.env.SMTP_FROM;
    const gmailName = process.env.GMAIL_SENDER_NAME || 'Pedidos';
    const gmailEmail= pickEnv('GMAIL_SENDER_EMAIL', 'GMAIL_SENDER');
    const from = fromSmtp || (gmailEmail ? `"${gmailName}" <${gmailEmail}>` : 'no-reply@example.com');

    const to = body?.to || order.customer?.email || gmailEmail || fromSmtp;
    if (!to) return NextResponse.json({ error: 'Destinatário ausente (sem e-mail do cliente e sem fallback)' }, { status: 400 });

    const subject = body?.subject || renderEmailSubject(order);
    const text    = renderEmailText(order);
    const html    = renderEmailHtml(order);

    const attachments: nodemailer.Attachment[] = [];
    if (body?.attachPdf) {
      const pdf = await generateOrderPdfBuffer(order);
      attachments.push({
        filename: `pedido-${order.number ?? order.id}.pdf`,
        content: pdf,
        contentType: 'application/pdf',
      });
    }

    await transporter.sendMail({
      from, to, subject, text, html,
      attachments: attachments.length ? attachments : undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Falha ao enviar e-mail' }, { status: 500 });
  }
}
