// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs'); // <<< para hash da senha
const prisma = new PrismaClient();

async function main() {
  // ===== Usuário inicial (login) =====
  // Pode sobrescrever via env: SEED_EMAIL / SEED_PASSWORD / SEED_NAME
  const email = process.env.SEED_EMAIL || 'admin@empresa.com';
  const password = process.env.SEED_PASSWORD || 'admin123'; // troque depois!
  const name = process.env.SEED_NAME || 'Administrador';

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},                        // não sobrescreve se já existir
    create: { email, name, passwordHash },
  });

  // ===== Clientes =====
  const acme = await prisma.customer.upsert({
    where: { document: '12.345.678/0001-00' },
    update: {},
    create: {
      name: 'ACME Ltda',
      email: 'compras@acme.com',
      phone: '11999990000',
      document: '12.345.678/0001-00',
      city: 'São Paulo',
      state: 'SP',
      notes: 'Cliente prioritário',
    },
  });

  const beta = await prisma.customer.upsert({
    where: { document: '123.456.789-00' },
    update: {},
    create: {
      name: 'Beta Alimentos',
      email: 'contato@beta.com',
      phone: '11988887777',
      document: '123.456.789-00',
      city: 'Osasco',
      state: 'SP',
    },
  });

  // ===== Produtos (preço padrão) =====
  const cafe = await prisma.product.upsert({
    where: { sku: 'CAF-500' },
    update: {},
    create: {
      name: 'Café Torrado 500g',
      sku: 'CAF-500',
      unit: 'un',
      price: 22.9,
      description: 'Café torrado e moído 500g',
    },
  });

  const acucar = await prisma.product.upsert({
    where: { sku: 'ACU-1KG' },
    update: {},
    create: {
      name: 'Açúcar 1kg',
      sku: 'ACU-1KG',
      unit: 'kg',
      price: 6.5,
      description: 'Açúcar refinado 1kg',
    },
  });

  // ===== Preço por cliente (tabela especial) =====
  await prisma.customerPrice.upsert({
    where: { customerId_productId: { customerId: acme.id, productId: cafe.id } },
    update: { price: 21.5 },
    create: { customerId: acme.id, productId: cafe.id, price: 21.5 },
  });

  await prisma.customerPrice.upsert({
    where: { customerId_productId: { customerId: acme.id, productId: acucar.id } },
    update: { price: 6.2 },
    create: { customerId: acme.id, productId: acucar.id, price: 6.2 },
  });

  console.log('✅ Seed ok');
  console.log('👤 Usuário:', { email: user.email, name: user.name });
  console.log('🔐 Senha:', password, '(altere após o primeiro login)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
