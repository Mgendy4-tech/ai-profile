import Link from "next/link";

type LnkditWordmarkProps = {
  className?: string;
  size?: "compact" | "hero";
  showMark?: boolean;
};

export function LnkditMark({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="48" height="48" rx="14" fill="#0F172A" />
      <path d="M12 11V37H27" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M35 23V37" stroke="#22D3EE" strokeWidth="5" strokeLinecap="round" />
      <circle cx="35" cy="15" r="3" fill="#22D3EE" />
    </svg>
  );
}

export default function LnkditWordmark({ className = "", size = "compact", showMark = false }: LnkditWordmarkProps) {
  const wordmarkClass = size === "hero"
    ? "text-4xl tracking-[-0.055em] sm:text-5xl"
    : "text-base tracking-[-0.045em]";

  return (
    <Link href="/" aria-label="LNKDIT home" className={`inline-flex items-center gap-2 ${className}`}>
      {showMark && <LnkditMark className={size === "hero" ? "h-11 w-11" : "h-8 w-8"} />}
      <span aria-hidden="true" className={`whitespace-nowrap font-black leading-none ${wordmarkClass}`}>
        <span className="text-slate-950">LNKD</span><span className="text-cyan-500">IT</span>
      </span>
    </Link>
  );
}
