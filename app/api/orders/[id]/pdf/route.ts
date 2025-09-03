// app/api/orders/[id]/pdf/route.ts
import { generateOrderPdfBuffer } from '@/lib/pdf';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const order = body?.order;
  if (!order) {
    return new Response(JSON.stringify({ error: 'Pedido ausente' }), { status: 400 });
  }
  const pdf = await generateOrderPdfBuffer(order);
  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="pedido-${order.number ?? order.id}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
