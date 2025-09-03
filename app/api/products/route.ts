import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const rows = await prisma.product.findMany({
      select: { id: true, name: true, unit: true, price: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: 'Erro ao listar produtos' }, { status: 500 });
  }
}
