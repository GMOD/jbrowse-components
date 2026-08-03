import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { OverlayCanvas } from '@jbrowse/render-core'
import { observer } from 'mobx-react'

import { drawMafCodons } from '../../LinearMafRenderer/rendering/codons.ts'
import { getCodonColors } from '../../LinearMafRenderer/util.ts'

import type { CodonMarker } from './computeVisibleCodons.ts'

// Per-species amino-acid translation, drawn on the backend-independent Canvas2D
// overlay above the (still-visible) base/SNP cells, exactly like the nucleotide
// label overlay it replaces when translation is on.
const CodonTranslationOverlay = observer(function CodonTranslationOverlay({
  markers,
  width,
  height,
}: {
  markers: CodonMarker[]
  width: number
  height: number
}) {
  const palette = usePalette()
  if (markers.length === 0) {
    return null
  }
  return (
    <OverlayCanvas
      width={width}
      height={height}
      draw={ctx => {
        drawMafCodons(ctx, markers, getCodonColors(palette))
      }}
    />
  )
})

export default CodonTranslationOverlay
