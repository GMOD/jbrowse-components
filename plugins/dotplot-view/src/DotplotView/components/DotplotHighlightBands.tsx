import { observer } from 'mobx-react'

import type { DotplotViewModel } from '../model.ts'

// Draws translucent highlight bands for one region: a vertical band when the
// region's assembly is on the horizontal axis, a horizontal band when it is on
// the vertical axis (both, for self-vs-self plots). Visual-only — lives inside
// the pointerEvents:none SVG overlay.
const DotplotHighlightBands = observer(function DotplotHighlightBands({
  model,
  region,
  color,
}: {
  model: DotplotViewModel
  region: {
    assemblyName?: string
    refName: string
    start: number
    end: number
  }
  color: string
}) {
  const { hview, vview, viewWidth, viewHeight } = model
  const onH =
    region.assemblyName === undefined ||
    hview.assemblyNames.includes(region.assemblyName)
  const onV =
    region.assemblyName === undefined ||
    vview.assemblyNames.includes(region.assemblyName)
  const h = onH ? model.getHHighlightCoords(region) : undefined
  const v = onV ? model.getVHighlightCoords(region) : undefined
  return (
    <>
      {h ? (
        <rect
          x={h.left}
          y={0}
          width={h.width}
          height={viewHeight}
          fill={color}
        />
      ) : null}
      {v ? (
        <rect
          x={0}
          y={v.top}
          width={viewWidth}
          height={v.height}
          fill={color}
        />
      ) : null}
    </>
  )
})

export default DotplotHighlightBands
