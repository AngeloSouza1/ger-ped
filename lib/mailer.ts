// lib/mailer.ts
import { google } from 'googleapis';
import type { gmail_v1 } from 'googleapis';
import nodemailer from 'nodemailer';

type MailAttachment = {
  filename: string;
  content: Buffer | string;     // Buffer (recomendado) ou base64 string
  contentType?: string;         // ex.: 'application/pdf'
};

type MailInput = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  fromOverride?: string;
  attachments?: MailAttachment[];  // <=== SUPORTE A ANEXOS
};

function hasGmailCreds() {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GMAIL_REFRESH_TOKEN &&
    process.env.GMAIL_SENDER_EMAIL
  );
}

/** Codifica assunto UTF-8 em RFC2047 */
function encodeSubject(subject: string) {
  return `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
}

function b64Url(buf: Buffer) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function wrap76(s: string) {
  // Quebra base64 em linhas de até 76 chars (boa prática MIME)
  return s.replace(/.{1,76}/g, '$&\r\n').trim();
}

/** Monta MIME multipart/mixed com multipart/alternative + anexos */
function buildRawMime({
  from,
  to,
  subject,
  html,
  text,
  attachments,
}: {
  from: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
  attachments?: MailAttachment[];
}) {
  const MIXED = `mixed_${Math.random().toString(36).slice(2)}`;
  const ALT = `alt_${Math.random().toString(36).slice(2)}`;

  const bodyHtml = html ?? (text ? `<pre>${text}</pre>` : '');
  const bodyText = text ?? '';

  const lines: string[] = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${MIXED}"`,
    '',
    `--${MIXED}`,
    `Content-Type: multipart/alternative; boundary="${ALT}"`,
    '',
    `--${ALT}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    bodyText,
    '',
    `--${ALT}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    bodyHtml,
    '',
    `--${ALT}--`,
  ];

  // Anexos (opcional)
  (attachments ?? []).forEach((att) => {
    const contentB64 =
      Buffer.isBuffer(att.content)
        ? att.content.toString('base64')
        : // se vier string já base64, mantemos; se não tiver certeza, use Buffer no chamador
          att.content;

    lines.push(
      '',
      `--${MIXED}`,
      `Content-Type: ${att.contentType || 'application/octet-stream'}; name="${att.filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${att.filename}"`,
      '',
      wrap76(contentB64),
    );
  });

  lines.push('', `--${MIXED}--`);

  const raw = b64Url(Buffer.from(lines.join('\r\n')));
  return raw;
}

async function sendWithGmail(input: MailInput) {
  const {
    GMAIL_SENDER_NAME,
    GMAIL_SENDER_EMAIL,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GMAIL_REFRESH_TOKEN,
  } = process.env;

  const oAuth2 = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  oAuth2.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN! });
  // accessToken é gerenciado internamente; a chamada abaixo garante refresh válido
  await oAuth2.getAccessToken().catch(() => null);

  const gmail = google.gmail({ version: 'v1', auth: oAuth2 });
  const from =
    input.fromOverride ||
    `${GMAIL_SENDER_NAME || ''} <${GMAIL_SENDER_EMAIL}>`.trim();

  const to = Array.isArray(input.to) ? input.to.join(', ') : input.to;

  const raw = buildRawMime({
    from,
    to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    attachments: input.attachments,
  });

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  } as gmail_v1.Params$Resource$Users$Messages$Send);

  return res.data;
}

async function sendWithSMTP(input: MailInput) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! }
      : undefined,
  });

  const from =
    input.fromOverride || process.env.SMTP_FROM || 'no-reply@localhost';

  // Nodemailer já entende anexos nativamente
  const info = await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    attachments: (input.attachments || []).map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  });

  return { messageId: info.messageId };
}

export async function sendMail(input: MailInput) {
  if (hasGmailCreds()) {
    return sendWithGmail(input);
  }
  // fallback se Gmail não estiver configurado
  return sendWithSMTP(input);
}
