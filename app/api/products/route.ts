import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// GET /api/products
export async function GET() {
  try {
    const rows = await prisma.product.findMany({
      where: { deletedAt: null }, // ignora soft-deleted
      select: { id: true, name: true, unit: true, price: true },
      orderBy: { name: 'asc' },
    });

    const data = rows.map((p) => ({
      ...p,
      price:
        typeof p.price === 'object' && 'toNumber' in p.price
          ? p.price.toNumber()
          : p.price,
    }));

    return NextResponse.json(data, { status: 200 });
  } catch (err: unknown) {
    console.error('Erro ao listar produtos:', err);
    return NextResponse.json({ error: 'Erro ao listar produtos' }, { status: 500 });
  }
}

// POST /api/products
export async function POST(req: Request) {
  try {
    const body: { name?: string; unit?: string; price?: number | string } = await req.json();

    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const unit = typeof body?.unit === 'string' ? body.unit.trim() : '';
    const priceRaw = body?.price;

    if (!name) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });
    if (!unit) return NextResponse.json({ error: 'Unidade é obrigatória.' }, { status: 400 });
    if (priceRaw === undefined || priceRaw === null || priceRaw === '')
      return NextResponse.json({ error: 'Preço é obrigatório.' }, { status: 400 });

    const priceNum = Number(priceRaw);
    if (Number.isNaN(priceNum))
      return NextResponse.json({ error: 'Preço inválido.' }, { status: 400 });

    const created = await prisma.product.create({
      data: {
        name,
        unit,
        price: new Prisma.Decimal(priceNum),
        // deletedAt: null // opcional; por padrão já é null
      },
      select: { id: true, name: true, unit: true, price: true },
    });

    const data = {
      ...created,
      price:
        typeof created.price === 'object' && 'toNumber' in created.price
          ? created.price.toNumber()
          : created.price,
    };

    return NextResponse.json(data, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: 'Já existe um produto com esses dados.' }, { status: 409 });
    }
    console.error('Erro ao criar produto:', err);
    return NextResponse.json(
      { error: 'Erro ao criar produto', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
