import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { observer } from 'mobx-react'

import { indexSnpHighlightGeometry } from './indexArms.ts'

import type { LDDisplayModel } from '../model.ts'
import type { IndexSnpHighlightGeometry } from './indexArms.ts'

export function IndexSnpHighlightSvg({
  geometry,
}: {
  geometry: IndexSnpHighlightGeometry | undefined
}) {
  const { highlight } = usePalette()
  return geometry ? (
    <>
      <path
        data-testid="ld-index-snp-band"
        d={geometry.d}
        stroke={highlight.main}
        strokeOpacity={0.35}
        strokeWidth={geometry.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle
        cx={geometry.apex.x}
        cy={geometry.apex.y}
        r={4}
        fill={highlight.dark}
      />
    </>
  ) : null
}

const IndexSnpHighlight = observer(function IndexSnpHighlight({
  model,
}: {
  model: LDDisplayModel
}) {
  return (
    <svg
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: model.canvasWidth,
        height: model.height,
        pointerEvents: 'none',
      }}
    >
      <IndexSnpHighlightSvg geometry={indexSnpHighlightGeometry(model)} />
    </svg>
  )
})

export default IndexSnpHighlight
