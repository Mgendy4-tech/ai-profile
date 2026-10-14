import Link from "next/link";

type LnkditWordmarkProps = {
  className?: string;
  size?: "compact" | "header" | "hero";
  showMark?: boolean;
};

export function LnkditMark({ className = "" }: { className?: string }) {
  return <img aria-hidden="true" className={className} src="/icon.svg" alt="" />;
}

export default function LnkditWordmark({ className = "", size = "compact", showMark = false }: LnkditWordmarkProps) {
  const wordmarkClass = size === "hero"
    ? "text-4xl tracking-[-0.055em] sm:text-5xl"
    : size === "header"
      ? "text-[1.15rem] tracking-[-0.045em]"
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
