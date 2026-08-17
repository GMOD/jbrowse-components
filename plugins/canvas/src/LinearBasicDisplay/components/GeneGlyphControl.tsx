import { TrackControl } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import { GENE_GLYPH_MODE_OPTIONS } from '../geneGlyphMode.ts'
import { geneGlyphChipLabel, geneGlyphTooltip } from './geneGlyphTooltip.ts'

import type { IsoformPicks } from '../../RenderFeatureDataRPC/isoformPicks.ts'
import type { GeneGlyphMode } from '../geneGlyphMode.ts'

// Bottom-right control for isoform collapse, shown (see showGeneGlyphNotice)
// only while genes are collapsed to one transcript, so the user always has a
// visible sign that transcripts are hidden. It's present under 'auto' too, where
// the collapse is a zoom-driven decision the user never made and would otherwise
// have no cue for.
//
// Two looks for the same control, and the only difference between them is
// whether it carries a label. Until dismissed it's a loud text chip naming the
// rule that picked the transcripts on screen ("RefSeq Select"), whose (×) is a
// passive acknowledgement; dismissing shrinks it to the quiet always-there icon
// (it never removes the control, so re-opening the menu is one click away). Both
// open the same Auto / All / Representative options as the track menu's "Gene
// glyph" radio.
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
  // The loud chip only makes sense while transcripts are actually collapsed; in
  // any other mode (or once dismissed) the control stays reachable as the quiet
  // icon. Whether the control belongs on screen at all is the caller's call (it
  // mounts this only when the display offers a `geneGlyphNotice`).
  const noticeShowing = collapsed && !dismissed
  return (
    <TrackControl
      icon="isoform"
      tooltip={geneGlyphTooltip({
        mode: geneGlyphMode,
        collapsed,
        maxIsoforms,
        picks,
        noticeShowing,
      })}
      label={noticeShowing ? geneGlyphChipLabel(maxIsoforms, picks) : undefined}
      onDelete={noticeShowing ? onDismiss : undefined}
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
