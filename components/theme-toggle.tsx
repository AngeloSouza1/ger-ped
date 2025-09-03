"use client";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 ${className}`}
      title={isDark ? "Tema claro" : "Tema escuro"}
      aria-label="Alternar tema"
    >
      {mounted ? (isDark ? "🌙" : "☀️") : "…"}
    </button>
  );
}
