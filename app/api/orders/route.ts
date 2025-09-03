import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const orders = await prisma.order.findMany({
    include: { customer: true, items: true },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json(orders);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { customerId, items, notes } = body as {
    customerId: string;
    notes?: string;
    items: { productId: string; name: string; unit?: string; unitPrice: number; quantity: number; total: number }[];
  };

  const total = items.reduce((acc, it) => acc + Number(it.total), 0);
  const last = await prisma.order.findFirst({ orderBy: { number: "desc" } });
  const number = (last?.number ?? 0) + 1;

  const created = await prisma.order.create({
    data: {
      number,
      customerId,
      notes,
      total,
      items: {
        create: items.map(it => ({
          productId: it.productId,
          name: it.name,
          unit: it.unit,
          unitPrice: it.unitPrice,
          quantity: it.quantity,
          total: it.total,
        })),
      },
    },
    include: { items: true, customer: true },
  });

  return NextResponse.json(created, { status: 201 });
}
