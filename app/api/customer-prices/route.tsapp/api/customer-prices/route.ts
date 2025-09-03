import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const rows = await prisma.customerPrice.findMany({
    include: { customer: true, product: true }
  });
  return NextResponse.json(rows);
}
export async function POST(req: Request) {
  const body = await req.json(); // { customerId, productId, price }
  const upserted = await prisma.customerPrice.upsert({
    where: { customerId_productId: { customerId: body.customerId, productId: body.productId } },
    update: { price: body.price },
    create: body,
  });
  return NextResponse.json(upserted, { status: 201 });
}
