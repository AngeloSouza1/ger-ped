"use client";
import { useState } from "react";

export default function Logo({ className = "h-6 w-6" }: { className?: string }) {
  const [err, setErr] = useState(false);
  if (err) {
    return <div className={`${className} rounded-sm ring-1 ring-gray-200 dark:ring-gray-800 bg-gray-200 dark:bg-gray-800`} aria-label="Logo" />;
  }
  return (
    <img
      src="/logo.svg"
      alt="Logo"
      className={`${className} rounded-sm ring-1 ring-gray-200 dark:ring-gray-800`}
      onError={() => setErr(true)}
    />
  );
}
