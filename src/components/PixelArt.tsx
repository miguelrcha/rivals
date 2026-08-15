type PixelArtProps = {
  pattern: string[];
  pixelSize?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Renders an ASCII bitmap ("1" = filled, anything else = empty) as a
 * crisp CSS grid of squares. Used for every hand-authored 8-bit icon
 * on the page (brackets, rocket, bulb, static clusters).
 */
export function PixelArt({
  pattern,
  pixelSize = 6,
  color = "var(--ink)",
  className,
  style,
}: PixelArtProps) {
  const cols = Math.max(...pattern.map((row) => row.length));

  return (
    <div
      className={className}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, ${pixelSize}px)`,
        gridTemplateRows: `repeat(${pattern.length}, ${pixelSize}px)`,
        lineHeight: 0,
        ...style,
      }}
      aria-hidden="true"
    >
      {pattern.flatMap((row, r) =>
        Array.from({ length: cols }, (_, c) => {
          const filled = row[c] === "1";
          return (
            <span
              key={`${r}-${c}`}
              style={{
                width: pixelSize,
                height: pixelSize,
                background: filled ? color : "transparent",
              }}
            />
          );
        })
      )}
    </div>
  );
}
