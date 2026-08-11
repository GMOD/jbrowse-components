import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { OverlayCanvas } from '@jbrowse/render-core'
import { observer } from 'mobx-react'

import { drawMafCodons } from '../../LinearMafRenderer/rendering/codons.ts'
import { getCodonColors } from '../../LinearMafRenderer/util.ts'

import type { CodonMarker } from './computeVisibleCodons.ts'

// Per-species amino-acid translation on the backend-independent Canvas2D
// overlay, in the place the nucleotide label overlay occupies the rest of the
// time — `visibleLabels` and this are gated on opposite sides of
// `basesRenderingActive`, so exactly one of them is ever non-empty.
//
// It *replaces* the base/SNP cells rather than sitting over them: codon view
// makes `basesRenderingActive` false, so the GPU canvas encodes an empty buffer
// and paints nothing underneath. That is what lets `same` codons take no fill
// (see `getCodonColors`) — over live SNP cells an unfilled codon would read as
// the nucleotide coloring showing through rather than as "conserved".
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
