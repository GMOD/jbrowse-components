import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import OverlayCanvas from '@jbrowse/render-core/OverlayCanvas'
import { observer } from 'mobx-react'

import { drawMafCodons } from '../../LinearMafRenderer/rendering/codons.ts'

import type { CodonGlyph } from '../codons.ts'

// The codon view's amino-acid letters, over the cells the backend paints.
const CodonTranslationOverlay = observer(function CodonTranslationOverlay({
  glyphs,
  width,
  height,
}: {
  glyphs: CodonGlyph[]
  width: number
  height: number
}) {
  const palette = usePalette()
  if (glyphs.length === 0) {
    return null
  }
  return (
    <OverlayCanvas
      width={width}
      height={height}
      draw={ctx => {
        drawMafCodons(ctx, glyphs, palette.text.primary)
      }}
    />
  )
})

export default CodonTranslationOverlay
