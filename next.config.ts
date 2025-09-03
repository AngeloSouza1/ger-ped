/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: { root: __dirname },
  // habilita carregar /_next/* quando abrir via IP na rede
  allowedDevOrigins: [
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://192.168.0.108:3001',
  ],
};

module.exports = nextConfig;
