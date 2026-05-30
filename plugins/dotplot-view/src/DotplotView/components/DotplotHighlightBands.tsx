import { observer } from 'mobx-react'

import type { DotplotViewModel } from '../model.ts'

const DotplotHighlightBands = observer(function DotplotHighlightBands({
  model,
  region,
  color,
}: {
  model: DotplotViewModel
  region: { assemblyName?: string; refName: string; start: number; end: number }
  color: string
}) {
  const { viewWidth, viewHeight } = model
  const h = model.getHHighlightCoords(region)
  const v = model.getVHighlightCoords(region)
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
