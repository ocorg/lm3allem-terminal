/** The store logo (round mark). Files live in /public/brand and are also the app icons. */
export function BrandLogo({ size = 96, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={size <= 160 ? "/brand/logo-round-160.webp" : "/brand/logo-round.webp"}
      alt="لمعلم | Lm3allem Clothing"
      width={size}
      height={size}
      decoding="async"
      style={{ display: "block", width: size, height: size, borderRadius: "50%", flexShrink: 0, ...style }}
    />
  )
}
