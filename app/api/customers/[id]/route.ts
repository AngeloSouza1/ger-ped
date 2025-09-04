// app/api/customers/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = { id: string };

// helper p/ checar código de erro do Prisma sem usar `any`
const hasCode = (err: unknown): err is { code: string } =>
  typeof (err as { code?: unknown })?.code === 'string';

// PUT /api/customers/[id]
export async function PUT(req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const { id } = await ctx.params;
    const data = (await req.json()) as Record<string, unknown>;

    // filtra apenas campos permitidos (string ou null)
    const allowed = new Set([
      'name',
      'email',
      'phone',
      'document',
      'addressLine1',
      'addressLine2',
      'city',
      'state',
      'zip',
    ]);

    const filtered = Object.fromEntries(
      Object.entries(data).filter(([k, v]) => {
        if (!allowed.has(k)) return false;
        return v === null || typeof v === 'string';
      }),
    ) as {
      name?: string;
      email?: string | null;
      phone?: string | null;
      document?: string | null;
      addressLine1?: string | null;
      addressLine2?: string | null;
      city?: string | null;
      state?: string | null;
      zip?: string | null;
    };

    const updated = await prisma.customer.update({
      where: { id },
      data: filtered,
    });

    return NextResponse.json(updated);
  } catch (err: unknown) {
    if (hasCode(err) && err.code === 'P2025') {
      return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Falha ao atualizar cliente.' }, { status: 400 });
  }
}

// DELETE /api/customers/[id]
export async function DELETE(_req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const { id } = await ctx.params;
    await prisma.customer.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err: unknown) {
    if (hasCode(err) && err.code === 'P2025') {
      return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Falha ao excluir cliente.' }, { status: 400 });
  }
}
