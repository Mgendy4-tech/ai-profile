import Link from "next/link";

export default function LnkditWordmark({ className = "" }: { className?: string }) {
  return (
    <Link href="/" aria-label="LNKDIT home" className={`inline-flex items-center gap-2 ${className}`}>
      <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-950 text-sm font-black tracking-tight text-cyan-300 shadow-sm">L</span>
      <span className="text-sm font-black tracking-[0.22em] text-slate-950">LNKDIT</span>
    </Link>
  );
}
