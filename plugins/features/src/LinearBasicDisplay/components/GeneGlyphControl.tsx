import TrackControl from '@jbrowse/display-kit/TrackControl'
import { observer } from 'mobx-react'

import { GENE_GLYPH_MODE_OPTIONS } from '../geneGlyphMode.ts'
import { geneGlyphChipLabel, geneGlyphTooltip } from './geneGlyphTooltip.ts'

import type { IsoformPicks } from '../../RenderFeatureDataRPC/isoformPicks.ts'
import type { GeneGlyphMode } from '../geneGlyphMode.ts'

// Opening the menu is how the user reads the notice, so the menu closing by any
// route is the acknowledgement that shrinks the chip back to its icon.
const GeneGlyphControl = observer(function GeneGlyphControl({
  collapsed,
  maxIsoforms,
  picks,
  dismissed,
  geneGlyphMode,
  onSetGeneGlyphMode,
  onDismiss,
}: {
  collapsed: boolean
  maxIsoforms?: number
  picks?: IsoformPicks
  dismissed: boolean
  geneGlyphMode: GeneGlyphMode
  onSetGeneGlyphMode: (value: GeneGlyphMode) => void
  onDismiss: () => void
}) {
  const noticeShowing = collapsed && !dismissed
  return (
    <TrackControl
      icon="isoform"
      tooltip={geneGlyphTooltip({
        mode: geneGlyphMode,
        collapsed,
        maxIsoforms,
        picks,
      })}
      label={noticeShowing ? geneGlyphChipLabel(maxIsoforms, picks) : undefined}
      onMenuClose={noticeShowing ? onDismiss : undefined}
      options={GENE_GLYPH_MODE_OPTIONS.map(option => ({
        label: option.label,
        selected: geneGlyphMode === option.value,
        onSelect: () => {
          onSetGeneGlyphMode(option.value)
        },
      }))}
    />
  )
})

export default GeneGlyphControl
