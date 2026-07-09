import { CascadingMenuButton } from '@jbrowse/core/ui'
import SegmentIcon from '@mui/icons-material/Segment'
import { observer } from 'mobx-react'

import { GENE_GLYPH_MODE_OPTIONS } from '../geneGlyphMode.ts'
import { useIndicatorButtonStyles } from './useIndicatorButtonStyles.ts'

import type { GeneGlyphMode } from '../geneGlyphMode.ts'

// Persistent, subtle gene-glyph switcher in the bottom-right indicator cluster.
// Self-gating: shown only when the loaded data actually has multi-isoform genes,
// so there's a real Auto / All / Longest-coding choice to make (meaningless on a
// BED/BAM track). The icon opens the same options as the track menu's "Gene
// glyph" radio.
const GeneGlyphControl = observer(function GeneGlyphControl({
  visible,
  geneGlyphMode,
  onSetGeneGlyphMode,
}: {
  visible: boolean
  geneGlyphMode: GeneGlyphMode
  onSetGeneGlyphMode: (value: GeneGlyphMode) => void
}) {
  const { classes } = useIndicatorButtonStyles()
  return visible ? (
    <CascadingMenuButton
      size="small"
      className={classes.button}
      stopPropagation
      tooltip="Gene display — one transcript per gene or all isoforms"
      menuItems={GENE_GLYPH_MODE_OPTIONS.map(option => ({
        label: option.label,
        type: 'radio' as const,
        checked: geneGlyphMode === option.value,
        onClick: () => {
          onSetGeneGlyphMode(option.value)
        },
      }))}
    >
      <SegmentIcon />
    </CascadingMenuButton>
  ) : null
})

export default GeneGlyphControl
