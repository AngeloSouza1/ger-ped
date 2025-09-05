// app/login/page.tsx
import { Suspense } from "react";
import LoginClient from "./_LoginClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-slate-500">Carregando…</div>}>
      <LoginClient />
    </Suspense>
  );
}
