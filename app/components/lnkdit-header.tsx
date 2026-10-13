import type { ReactNode } from "react";
import LnkditWordmark from "./lnkdit-wordmark";

export default function LnkditHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="mb-8 flex min-h-10 items-center justify-between gap-4 border-b border-slate-200 pb-4">
      <LnkditWordmark />
      {children}
    </header>
  );
}
