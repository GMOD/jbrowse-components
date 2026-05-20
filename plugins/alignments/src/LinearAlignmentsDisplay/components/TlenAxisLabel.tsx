import type React from 'react'

// Vertical "TLEN" label drawn alongside the insert-size scalebar in samplot
// mode. Centered between the band's yTop/yBottom and rotated -90°. Shared
// between the on-screen overlay and the SVG export so they stay in sync.
export default function TlenAxisLabel({
  yTop,
  yBottom,
  x = 42,
}: {
  yTop: number
  yBottom: number
  x?: number
}): React.ReactElement {
  const midY = (yTop + yBottom) / 2
  return (
    <text
      x={x}
      y={midY}
      fontSize={10}
      fontFamily="sans-serif"
      textAnchor="middle"
      transform={`rotate(-90, ${x}, ${midY})`}
    >
      TLEN
    </text>
  )
}
