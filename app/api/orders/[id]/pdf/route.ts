// app/api/orders/[id]/pdf/route.ts
import { generateOrderPdfBuffer, type OrderInput } from '@/lib/pdf';

export const runtime = 'nodejs'; // Puppeteer precisa do runtime Node

export async function POST(req: Request) {
  let order: OrderInput | undefined;

  try {
    const body = (await req.json()) as unknown;
    if (body && typeof body === 'object' && 'order' in body) {
      order = (body as { order?: OrderInput }).order;
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

  const pdf = await generateOrderPdfBuffer(order);
  const filename = `pedido-${String(order.number ?? order.id ?? 'sem-numero')}.pdf`;

  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
