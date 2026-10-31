// Rotated red "VENDIDO" stamp, same look as the Instagram sold flyers.
// Drop it inside a `relative` media box; pair it with `soldMediaClass` on
// that box so the photo behind it is greyed out and dimmed.
export const soldMediaClass = "[&_img]:grayscale-75 [&_img]:brightness-50";

export function SoldStamp({ size = "sm" }: { size?: "sm" | "lg" }) {
  const sizeClass =
    size === "lg"
      ? "border-[5px] text-7xl md:text-8xl px-6 pt-3 pb-1"
      : "border-[3px] text-[34px] px-3.5 pt-1.5 pb-0.5";
  return (
    <span
      className={`absolute left-1/2 top-1/2 z-10 pointer-events-none -translate-x-1/2 -translate-y-1/2 -rotate-8 whitespace-nowrap border-accent bg-bg-deep/85 font-display leading-none text-accent ${sizeClass}`}
    >
      VENDIDO
    </span>
  );
}
