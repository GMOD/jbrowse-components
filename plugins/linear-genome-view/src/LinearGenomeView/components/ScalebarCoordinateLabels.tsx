import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import {
  TICK_LABEL_FONT_SIZE,
  refNameLabelSpanPx,
  tickLabelWidth,
} from '../util.ts'

import type { LinearGenomeViewModel } from '../index.ts'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()(theme => ({
  // spans the full staticBlocks width; labels are absolutely positioned within
  // it so a label on an internal (~800px) block boundary is no longer clipped.
  // Absolute (with top/left left at their static position, i.e. the top-left of
  // the scalebar Paper) so a strip wider than the viewport adds no flow width
  container: {
    position: 'absolute',
    height: 13,
    pointerEvents: 'none',
    // clip rather than hidden so this never becomes a scroll container (see
    // Scalebar)
    overflow: 'clip',
  },
  tick: {
    position: 'absolute',
    width: 0,
    display: 'flex',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  tickLabel: {
    fontSize: TICK_LABEL_FONT_SIZE,
    zIndex: 1,
    lineHeight: 'normal',
    pointerEvents: 'none',
    // paper backing so the number stays readable over the gridline behind it
    background: theme.palette.background.paper,
    padding: '0 2px',
  },
}))

const ScalebarCoordinateLabels = observer(function ScalebarCoordinateLabels({
  model,
}: {
  model: LGV
}) {
  const { classes } = useStyles()
  const { scalebarLabels, staticBlocks, staticBlocksTranslateX } = model
  // labels are laid out in the staticBlocks frame, which overhangs the
  // viewport; shift it into view (the -1 clears the left track border, as
  // Gridlines/PaddingBlocks do with their `offset` prop). Rounded, unlike
  // ZoomTransform: these children are text, and a fractional offset blurs it.
  const offsetLeft = Math.round(staticBlocksTranslateX)

  // `runRefNameLabelPx` keeps the numbers out from under a refName label at its
  // run's left edge, in this frame, which is what lets scalebarLabels stay
  // stable across a scroll. It cannot reach the label pinned to the VIEWPORT's
  // left edge, whose x is a function of the scroll — and that one is drawn over
  // a run whose own left edge is off screen, so nothing reserved for it. The
  // number underneath came out with its leading digits painted over: "22,000"
  // showing as ",000" reads as a coordinate, just not the right one. Hide it
  // instead, the same call the run-start reservation makes, and hide rather
  // than drop so the node count this list pools stays put.
  //
  // The row's caption chip is the other one: it sits at x=0, outside the block
  // frame for the same reason, and now draws on a plain LGV too whenever the
  // row is flipped.
  const { labels, caption, captionSpanPx } = model.scalebarRefNameLabels
  const sticky = labels.find(l => l.sticky)
  const covered = [
    ...(sticky ? [refNameLabelSpanPx(sticky)] : []),
    ...(caption === undefined ? [] : [{ left: 0, right: captionSpanPx }]),
  ]

  return (
    <div
      className={classes.container}
      style={{
        width: staticBlocks.totalWidthPx,
        transform: `translateX(${offsetLeft - 1}px)`,
      }}
    >
      {/* Keyed by POSITION, not by `key` (the run/base identity), which makes
      this list a pool: the nodes are repositioned and relabelled rather than
      unmounted and remounted. Keying by base looks better and is the wrong way
      round — it reuses nodes across a pan, where `scalebarLabels` is already
      unchanged and nothing churns anyway, and changes every key on a *zoom*,
      where the whole tick set moves. That tore down and rebuilt ~144 nodes a
      frame, each paying the emotion `tickLabel` styling on the way in, and it
      was the largest single source of DOM churn during interaction. These are
      stateless text nodes, so position is a safe identity.
      reference/INTERACTION_PERF.md has the measurement. */}
      {scalebarLabels.map(({ x, label }, i) => {
        const halfWidth = tickLabelWidth(label) / 2
        const centerPx = offsetLeft - 1 + x
        const hidden = covered.some(
          span =>
            centerPx - halfWidth < span.right &&
            centerPx + halfWidth > span.left,
        )
        return (
          <div
            // eslint-disable-next-line @eslint-react/no-array-index-key -- position IS the identity here; keying by label is what the pooling above removes
            key={i}
            className={classes.tick}
            style={{
              transform: `translateX(${x}px)`,
              visibility: hidden ? 'hidden' : undefined,
            }}
          >
            <div className={classes.tickLabel}>{label}</div>
          </div>
        )
      })}
    </div>
  )
})

export default ScalebarCoordinateLabels
