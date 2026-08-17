import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { contentScreenY, sectionKey } from './sectionScreen.ts'

import type { LinearAlignmentsDisplayModel } from '../model.ts'

// Where a pileup clipped by the display-wide `maxHeight` stops: a hairline
// across the bottom of the laid-out rows, captioned, scrolling with the reads.
//
// This used to be a `warning`-toned chip pinned in the bottom-right corner whose
// press set `maxHeight` to 1,000,000. Both halves were wrong, and the press was
// the worse one: it writes a CONFIG SLOT, so a single click committed the track
// to laying out every read at every locus, the notice then vanished, and the
// only way back was a dialog in the track menu. Reported as having been
// dismissed by someone who did not expect a click to do anything irreversible.
//
// The alert tone was the other half. Reads collapsing onto the bottom row is
// the cap doing its job at a depth the cap was written for, not a fault, and an
// alert-toned mark says a fault. (An earlier draft of this comment claimed the
// 6000px default is reached at essentially every locus at 300x, which is simply
// false — measured on HG002 300x at 1:2,000,000, the pileup lays out 431 rows
// against a cap that allows 750. It takes roughly 1.7x that depth, or a larger
// `featureHeight`, to reach it. The tone is wrong on its own terms; it did not
// need a frequency argument and the one it had was invented.)
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
// The caption hangs below the rule: this much clear of it, and this tall. Both
// are read by the cull below as well as by the layout, which is the reason they
// are numbers here rather than literals in the style block.
const CAPTION_GAP_PX = 2
const CAPTION_LINE_PX = 12

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
    // No `top` here: the component sets one inline per section, which would
    // override anything declared at this level. It used to declare `top: 2` and
    // read as the gap below the rule; the inline value clobbered it and the text
    // sat on the hairline. `CAPTION_GAP_PX` is that gap, applied where the
    // number is actually decided.
    //
    // BELOW the line is the intent rather than a guess at one, and `rule` above
    // is where that is said independently: it is a zero-height box precisely so
    // "the caption below can sit outside it". A caption ON the rule is the other
    // reading — a label knocking a gap in a hairline is a real idiom, and the
    // paper background here would serve it — but it is not what either comment
    // asks for, and the two agreed with each other while the screen agreed with
    // neither.
    fontSize: 10,
    lineHeight: CAPTION_LINE_PX,
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
        // Off the section, not looked back up by its key: a `renderSections`
        // entry IS its lane, and the display-wide suppressions are already in
        // the field.
        if (!section.ceilingClipped) {
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
        // Culled on the pair's extent, not the line's alone. The caption hangs
        // BELOW the rule, so scrolling the boundary just off the top leaves its
        // text on screen for another `CAPTION_GAP_PX + CAPTION_LINE_PX` — and
        // culling at 0 took the caption away while its own subject was still
        // legible. The bottom needs no such slack, since anything below the rule
        // is further below the viewport.
        if (
          top < -(CAPTION_GAP_PX + CAPTION_LINE_PX) ||
          top > scroll.canvasHeight
        ) {
          return null
        }
        return (
          <div key={sectionKey(section.groupKey)}>
            {/* The line IS the claim — it is the boundary the reads stop at —
                so it is what the tests assert a position on. They used to read
                the caption's `top` as a proxy, which held only while the caption
                sat exactly on the rule rather than clear of it. */}
            <div
              data-testid="pileup-truncation-rule"
              className={classes.rule}
              style={{ top }}
            />
            <div
              className={classes.caption}
              style={{ top: top + CAPTION_GAP_PX }}
            >
              Max height reached — deeper reads are not stacked
            </div>
          </div>
        )
      })}
    </>
  )
})

export default PileupTruncationRule
