import type { JBrowsePalette } from '@jbrowse/core/ui/palette'

// Vertical "TLEN" label drawn alongside the insert-size scalebar in read cloud
// mode. Centered between the band's yTop/yBottom and rotated -90°. Shared
// between the on-screen overlay and the SVG export so they stay in sync.
// Colored and haloed as `YScaleBar` colors the numbers it captions.
export default function TlenAxisLabel({
  yTop,
  yBottom,
  x,
  palette,
}: {
  yTop: number
  yBottom: number
  x: number
  palette: JBrowsePalette
}) {
  const midY = (yTop + yBottom) / 2
  return (
    <text
      x={x}
      y={midY}
      fontSize={10}
      textAnchor="middle"
      fill={palette.text.primary}
      stroke={palette.background.default}
      strokeWidth={2.5}
      paintOrder="stroke"
      transform={`rotate(-90, ${x}, ${midY})`}
    >
      TLEN
    </text>
  )
}
