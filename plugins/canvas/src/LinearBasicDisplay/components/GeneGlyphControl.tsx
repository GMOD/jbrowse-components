import { TrackControl } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import { GENE_GLYPH_MODE_OPTIONS } from '../geneGlyphMode.ts'
import { geneGlyphTooltip } from './geneGlyphTooltip.ts'

import type { GeneGlyphMode } from '../geneGlyphMode.ts'

// Bottom-right control for isoform collapse, shown (see showGeneGlyphNotice)
// only while genes are collapsed to their longest coding transcript, so the user
// always has a visible sign that transcripts are hidden. It's present under
// 'auto' too, where the collapse is a zoom-driven decision the user never made
// and would otherwise have no cue for.
//
// Two looks for the same control, and the only difference between them is
// whether it carries a label. Until dismissed it's a loud text chip ("Longest
// isoform") whose (×) is a passive acknowledgement; dismissing shrinks it to the
// quiet always-there icon (it never removes the control, so re-opening the menu
// is one click away). Both open the same Auto / All / Longest-coding options as
// the track menu's "Gene glyph" radio.
const GeneGlyphControl = observer(function GeneGlyphControl({
  collapsed,
  maxIsoforms,
  dismissed,
  geneGlyphMode,
  onSetGeneGlyphMode,
  onDismiss,
}: {
  collapsed: boolean
  maxIsoforms?: number
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
  // a gene drawn with 7 of its 28 transcripts looks exactly like a gene with 7,
  // so the chip names which collapse it is rather than leaving it to the tooltip
  const label =
    maxIsoforms === undefined
      ? 'Longest isoform'
      : `Top ${maxIsoforms} isoforms`
  return (
    <TrackControl
      icon="isoform"
      tooltip={geneGlyphTooltip({
        mode: geneGlyphMode,
        collapsed,
        maxIsoforms,
        noticeShowing,
      })}
      label={noticeShowing ? label : undefined}
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
