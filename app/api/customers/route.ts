import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // ajuste o caminho se for outro

export async function GET() {
  try {
    const rows = await prisma.customer.findMany({
      select: { id: true, name: true, email: true, phone: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(rows); // SEMPRE JSON
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao listar clientes' }, { status: 500 });
  }
}
