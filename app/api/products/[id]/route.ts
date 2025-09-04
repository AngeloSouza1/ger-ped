// app/api/products/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/products/:id
export async function GET(_: Request, { params }: Ctx) {
  try {
    const { id } = await params;

    const row = await prisma.product.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, unit: true, price: true },
    });

    if (!row) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    const data = {
      ...row,
      price:
        typeof row.price === 'object' && 'toNumber' in row.price
          ? row.price.toNumber()
          : row.price,
    };

    return NextResponse.json(data, { status: 200 });
  } catch (err: unknown) {
    console.error('GET /api/products/[id] error:', err);
    return NextResponse.json({ error: 'Erro ao buscar produto' }, { status: 500 });
  }
}

// PUT /api/products/:id
export async function PUT(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const body: { name?: string; unit?: string; price?: number | string } = await req.json();

    const exists = await prisma.product.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!exists) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    const patch: { name?: string; unit?: string; price?: Prisma.Decimal } = {};

    if (typeof body.name === 'string') {
      const name = body.name.trim();
      if (!name) return NextResponse.json({ error: 'Nome inválido.' }, { status: 400 });
      patch.name = name;
    }

    if (typeof body.unit === 'string') {
      const unit = body.unit.trim();
      if (!unit) return NextResponse.json({ error: 'Unidade inválida.' }, { status: 400 });
      patch.unit = unit;
    }

    if (body.price !== undefined) {
      const priceNum = Number(body.price);
      if (Number.isNaN(priceNum)) return NextResponse.json({ error: 'Preço inválido.' }, { status: 400 });
      patch.price = new Prisma.Decimal(priceNum);
    }

    const updated = await prisma.product.update({
      where: { id },
      data: patch,
      select: { id: true, name: true, unit: true, price: true },
    });

    const data = {
      ...updated,
      price:
        typeof updated.price === 'object' && 'toNumber' in updated.price
          ? updated.price.toNumber()
          : updated.price,
    };

    return NextResponse.json(data, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: 'Conflito de unicidade.' }, { status: 409 });
    }
    console.error('PUT /api/products/[id] error:', err);
    return NextResponse.json(
      { error: 'Erro ao atualizar produto', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// DELETE /api/products/:id (soft delete)
export async function DELETE(_: Request, { params }: Ctx) {
  try {
    const { id } = await params;

    const exists = await prisma.product.findUnique({ where: { id } });
    if (!exists) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    await prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    console.error('DELETE /api/products/[id] error:', err);
    return NextResponse.json(
      { error: 'Erro ao deletar produto', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
