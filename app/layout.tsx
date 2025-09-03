import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gerador de Pedidos",
  description: "Emissão de pedidos com clientes, produtos e preços por cliente.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="light" suppressHydrationWarning>
      <head>
        {/* Define o tema antes da hidratação (localStorage ou preferência do SO) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  try {
    var m = localStorage.getItem('theme');
    if (!m) { m = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
    document.documentElement.setAttribute('data-theme', m);
  } catch (e) {}
})();
`}}
        />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
