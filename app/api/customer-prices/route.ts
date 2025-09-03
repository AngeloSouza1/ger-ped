import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const rows = await prisma.customerPrice.findMany({
      select: { customerId: true, productId: true, price: true },
    });
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: 'Erro ao listar preços especiais' }, { status: 500 });
  }
}
