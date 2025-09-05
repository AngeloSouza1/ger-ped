// app/api/customers/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

type InputObj = Record<string, unknown>;

function firstString(obj: InputObj, keys: string[]): string | null {
  for (const k of keys) {
    const found = Object.keys(obj).find((kk) => kk.toLowerCase() === k.toLowerCase());
    if (!found) continue;
    const v = obj[found];
    if (typeof v === 'string' || typeof v === 'number') return String(v);
  }
  return null;
}

function pickNested(raw: InputObj, keyName: string): InputObj | null {
  const k = Object.keys(raw).find((kk) => kk.toLowerCase() === keyName.toLowerCase());
  const v = k ? raw[k] : null;
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as InputObj) : null;
}

function pickCustomerShape(raw: InputObj): InputObj {
  // aceita payloads do tipo { customer: {...} } OU { data: {...} }
  return pickNested(raw, 'customer') ?? pickNested(raw, 'data') ?? raw;
}

async function parseBody(req: Request): Promise<InputObj> {
  const ct = req.headers.get('content-type') || '';
  if (ct.startsWith('application/json')) {
    const json = (await req.json().catch(() => null)) as unknown;
    return json && typeof json === 'object' ? (json as InputObj) : {};
  }
  if (ct.startsWith('multipart/form-data')) {
    const fd = await req.formData();
    const out: InputObj = {};
    for (const [k, v] of fd.entries()) if (typeof v === 'string') out[k] = v;
    return out;
  }
  if (ct.startsWith('application/x-www-form-urlencoded')) {
    const txt = await req.text();
    const params = new URLSearchParams(txt);
    const out: InputObj = {};
    params.forEach((v, k) => (out[k] = v));
    return out;
  }
  // fallback: tenta JSON
  try {
    const j = (await req.json()) as unknown;
    return j && typeof j === 'object' ? (j as InputObj) : {};
  } catch {
    return {};
  }
}

// GET /api/customers
export async function GET() {
  try {
    const rows = await prisma.customer.findMany({
      select: { id: true, name: true, email: true, phone: true, document: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(rows, { status: 200 });
  } catch (err: unknown) {
    console.error('GET /api/customers error:', err);
    return NextResponse.json({ error: 'Erro ao listar clientes' }, { status: 500 });
  }
}

// POST /api/customers (documento OPCIONAL)
export async function POST(req: Request) {
  try {
    const raw = await parseBody(req);
    const obj = pickCustomerShape(raw);

    // aceita variações comuns
    const name = (firstString(obj, ['name', 'nome', 'customerName', 'razaoSocial', 'fantasia']) ?? '').trim();
    const emailRaw = firstString(obj, ['email']);
    const phoneRaw = firstString(obj, ['phone', 'tel', 'telefone', 'cell', 'celular']);
    const docRaw = firstString(obj, ['document', 'doc', 'cpf', 'cnpj', 'cpfCnpj', 'cpf_cnpj']);

    const email = emailRaw ? emailRaw.trim() : null;
    const phone = phoneRaw ? phoneRaw.replace(/\D/g, '') : null;

    // documento é opcional: converte vazio em null
    const docDigits = docRaw ? docRaw.replace(/\D/g, '') : '';
    const document = docDigits.length > 0 ? docDigits : null;

    // validações (sem exigir documento)
    const errors: string[] = [];
    if (!name) errors.push('Nome é obrigatório.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('E-mail inválido.');

    if (errors.length > 0) {
      const debug =
        process.env.NODE_ENV !== 'production'
          ? { receivedKeys: Object.keys(raw), interpreted: { name, email, phone, document }, original: obj }
          : undefined;
      return NextResponse.json({ error: errors.join(' '), debug }, { status: 400 });
    }

    const created = await prisma.customer.create({
      data: { name, email, phone, document }, // document pode ser null
      select: { id: true, name: true, email: true, phone: true, document: true },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // identifica qual campo bateu a unique (document/email)
      const target = Array.isArray((err.meta as { target?: unknown })?.target)
        ? ((err.meta as { target?: unknown })?.target as string[]).join(', ')
        : (err.meta as { target?: string })?.target;

      const msg =
        target?.includes('document')
          ? 'Já existe um cliente com esse documento.'
          : target?.includes('email')
            ? 'Já existe um cliente com esse e-mail.'
            : 'Registro duplicado.';
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    console.error('POST /api/customers error:', err);
    return NextResponse.json(
      { error: 'Erro ao criar cliente', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
