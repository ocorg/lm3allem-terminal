type SkeletonVariant = "text" | "card" | "circle" | "row"

interface SkeletonProps {
  variant?: SkeletonVariant
  width?:   string | number
  height?:  string | number
  lines?:   number
}

export function Skeleton({
  variant = "text",
  width,
  height,
  lines = 1,
}: SkeletonProps) {
  if (variant === "circle") {
    const size = typeof width === "number" ? width : 40
    return (
      <div
        className="skeleton"
        style={{ width: size, height: height ?? size, borderRadius: "50%" }}
      />
    )
  }

  if (variant === "card") {
    return (
      <div
        className="skeleton"
        style={{ width: width ?? "100%", height: height ?? 120, borderRadius: 12 }}
      />
    )
  }

  if (variant === "row") {
    return (
      <div
        className="skeleton"
        style={{ width: width ?? "100%", height: height ?? 20, borderRadius: 4 }}
      />
    )
  }

  // "text" — supports multi-line with last line at 70%
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{
            height:       height ?? 14,
            width:        i === lines - 1 && lines > 1 ? "70%" : "100%",
            borderRadius: 4,
          }}
        />
      ))}
    </div>
  )
}