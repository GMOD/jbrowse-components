import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { contentScreenY, sectionKey } from './sectionScreen.ts'

import type { LinearAlignmentsDisplayModel } from '../model.ts'

// Where a pileup clipped by the display-wide `maxHeight` stops: a hairline
// across the bottom of the laid-out rows, captioned, scrolling with the reads.
//
// This used to be a `warning`-toned chip pinned in the bottom-right corner whose
// press set `maxHeight` to 1,000,000. Both halves were wrong on deep data. The
// alert tone says something has gone wrong, but at 300x the 6000px default cap
// is reached at essentially every locus, so the chip was simply always lit —
// and a permanently-lit warning is not a disclosure, it is furniture. The press
// was worse: it wrote a config slot, so one click on an always-present control
// silently committed the track to laying out every read at every locus, with
// the notice then gone and the only way back a dialog in the track menu.
//
// So the notice is drawn where the fact is, at the boundary it is about, and
// does nothing when clicked. You meet it by scrolling to the end of the reads,
// which is exactly when "there were more" is worth knowing; a reader who does
// not scroll that far is not being asked to care. Raising the cap stays in the
// track menu ("Set max layout height..."), which is where a persistent setting
// belongs.
//
// PER SECTION, not per display: the ceiling is display-wide but the boundary is
// not, and a stacked grouping can have one lane clipped and the next not. The
// gate is `isGroupCeilingClipped`, which also carries the fit-mode and
// hidden-pileup suppressions.
const useStyles = makeStyles()(theme => ({
  rule: {
    position: 'absolute',
    left: 0,
    right: 0,
    // Reads collapse ONTO the last row rather than after it, so the boundary is
    // the row's own bottom edge. Drawn as a border on a zero-height box so the
    // caption below can sit outside it without the two disagreeing about where
    // the line is.
    height: 0,
    borderTop: `1px dashed ${theme.palette.text.disabled}`,
    pointerEvents: 'none',
    zIndex: 6,
  },
  caption: {
    position: 'absolute',
    left: 4,
    // Clear of the rule itself; the pileup below it is the collapsed overflow
    // row, which is what the caption is naming.
    top: 2,
    fontSize: 10,
    lineHeight: '12px',
    padding: '0 3px',
    color: theme.palette.text.secondary,
    background: theme.palette.background.paper,
    opacity: 0.8,
    whiteSpace: 'nowrap',
    userSelect: 'none',
    pointerEvents: 'none',
    zIndex: 6,
  },
}))

const PileupTruncationRule = observer(function PileupTruncationRule({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const { classes } = useStyles()
  const { scrollModel: scroll, renderSections } = model
  return (
    <>
      {renderSections.map(section => {
        if (!model.isGroupCeilingClipped(section.groupKey)) {
          return null
        }
        // The always-scrolling tier: `topOffset` is the section's `pileupTop`
        // and the rows below it scroll in both grouped and ungrouped modes, so
        // this is `contentScreenY` rather than `bandScreenTop` — a sticky
        // projection would park the line over reads it is not the end of.
        const top = contentScreenY(
          section.topOffset + section.pileupHeight,
          scroll,
        )
        // Culled on the CAPTION's extent, not the line's: the caption hangs
        // below the rule, so a boundary a few px past the bottom edge still has
        // text on screen.
        if (top < 0 || top > scroll.canvasHeight) {
          return null
        }
        return (
          <div key={sectionKey(section.groupKey)}>
            <div className={classes.rule} style={{ top }} />
            <div className={classes.caption} style={{ top }}>
              Max height reached — deeper reads are not stacked
            </div>
          </div>
        )
      })}
    </>
  )
})

export default PileupTruncationRule
