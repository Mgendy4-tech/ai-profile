import type { AuthoredVariantDefinition } from "@/lib/authored-templates/variant-registry";
import { getAuthoredVariantPreview } from "@/lib/authored-templates/variant-preview";

type AuthoredVariantPreviewProps = {
  variant: AuthoredVariantDefinition;
  recommended: boolean;
  selected: boolean;
  onSelect: () => void;
};

const blockClasses = {
  image: "bg-slate-700",
  text: "bg-slate-300",
  card: "bg-slate-400",
  accent: "bg-amber-400",
} as const;

const sizeClasses = {
  short: "h-2",
  medium: "h-4",
  tall: "h-9",
  wide: "h-5",
} as const;

export default function AuthoredVariantPreview({
  variant,
  recommended,
  selected,
  onSelect,
}: AuthoredVariantPreviewProps) {
  const preview = getAuthoredVariantPreview(variant.id);

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${variant.displayName}${selected ? ", selected" : ""}${recommended ? ", AI recommended" : ""}`}
      onClick={onSelect}
      className={`min-w-0 overflow-hidden rounded-xl border p-3 text-left transition hover:border-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 ${selected ? "border-gray-900 ring-2 ring-gray-200" : "border-gray-200"}`}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <span className="min-w-0 text-sm font-semibold text-gray-900">{variant.displayName}</span>
        <span className="flex shrink-0 flex-wrap justify-end gap-1">
          {recommended && <span className="rounded-full bg-green-100 px-2 py-1 text-[10px] font-bold uppercase text-green-800">AI recommended</span>}
          {selected && <span className="rounded-full bg-gray-900 px-2 py-1 text-[10px] font-bold uppercase text-white">Selected</span>}
        </span>
      </div>
      <div
        role="img"
        aria-label={`${variant.displayName} preview: ${preview.rhythm}`}
        className="mt-3 grid min-h-24 grid-cols-4 gap-1 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-2"
      >
        {preview.blocks.map((block, index) => (
          <span
            key={`${variant.id}-${index}`}
            aria-hidden="true"
            className={`${blockClasses[block.kind]} ${sizeClasses[block.size]} min-w-0 self-center rounded-sm ${block.size === "wide" ? "col-span-4" : block.kind === "image" ? "col-span-2" : "col-span-1"}`}
          />
        ))}
      </div>
      <p className="mt-3 text-sm leading-6 text-gray-600">{variant.shortDescription}</p>
      <dl className="mt-3 grid gap-1 text-xs leading-5 text-gray-500">
        <div><dt className="inline font-semibold text-gray-700">Intent: </dt><dd className="inline">{variant.visualIntent}</dd></div>
        <div><dt className="inline font-semibold text-gray-700">Rhythm: </dt><dd className="inline">{preview.rhythm}</dd></div>
        <div><dt className="inline font-semibold text-gray-700">Best for: </dt><dd className="inline">{preview.bestFor.replace(/^Best for /, "")}</dd></div>
      </dl>
      {recommended && <p className="mt-3 text-xs leading-5 text-gray-700">Recommended because this profile fits the variant&apos;s {preview.imageEmphasis.toLowerCase()} and {preview.balance.toLowerCase()}.</p>}
    </button>
  );
}
