// app/api/orders/[id]/pdf/route.ts
import { generateOrderPdfBuffer, type OrderLike as PdfOrderLike } from '@/lib/pdf';

export const runtime = 'nodejs'; // Puppeteer precisa do runtime Node

export async function POST(req: Request) {
  let order: PdfOrderLike | undefined;

  try {
    const body: unknown = await req.json();
    if (body && typeof body === 'object' && 'order' in body) {
      order = (body as { order?: PdfOrderLike }).order;
    }
  } catch {
    // body inválido/sem JSON
  }

  if (!order) {
    return new Response(JSON.stringify({ error: 'Pedido ausente' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Gera o PDF como Buffer (Node)
  const pdf = await generateOrderPdfBuffer(order);
  const filename = `pedido-${String(order.number ?? order.id ?? 'sem-numero')}.pdf`;

  // ✅ Converte Buffer -> ArrayBuffer "puro" (sem SharedArrayBuffer)
  const ab = new ArrayBuffer(pdf.byteLength);
  new Uint8Array(ab).set(pdf); // copia os bytes do Buffer

  return new Response(ab, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdf.byteLength),
    },
  });
}
