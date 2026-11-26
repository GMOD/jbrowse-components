import { pluralize } from '@jbrowse/core/util'

import { bandScreenTop, contentScreenY } from './components/sectionScreen.ts'

import type { ScrollModel } from './components/sectionScreen.ts'

/** Px of the line under the cut that holds its caption. */
export const CUT_CAPTION_LINE_PX = 13

/** A fitted pitch is fractional, so rows filling the box can sum a hair short of it. */
const FLOAT_SLACK_ROWS = 1e-6

export interface PileupCutSection {
  pileupTop: number
  pileupHeight: number
  rowsHeight: number
  ceilingClipped: boolean
}

/**
 * Where an export of a pileup stops and what it says about the rest: `cutY`,
 * the y the last whole row above the caption line ends at, and `caption`, the
 * rows scrolled above, the rows left below, and whether the layout's ceiling
 * left reads unstacked. No cut is the whole box and an empty caption.
 */
export interface PileupCut {
  cutY: number
  caption: string
}

function sectionRows(
  section: PileupCutSection,
  rowHeight: number,
  scroll: ScrollModel,
  limit: number,
) {
  const rows = Math.round(section.rowsHeight / rowHeight)
  const rowBase = contentScreenY(section.pileupTop, scroll)
  const clipTop = bandScreenTop(section.pileupTop, scroll)
  const bandBottom = contentScreenY(
    section.pileupTop + section.pileupHeight,
    scroll,
  )
  const rowsTo = (y: number) =>
    Math.min(
      rows,
      Math.max(0, Math.floor((y - rowBase) / rowHeight + FLOAT_SLACK_ROWS)),
    )
  const above = rowsTo(Math.max(0, clipTop))
  const through = Math.max(above, rowsTo(Math.min(limit, bandBottom)))
  return {
    above,
    below: rows - through,
    drawn: through - above,
    end:
      bandBottom > limit
        ? Math.max(clipTop, rowBase + rowsTo(limit) * rowHeight)
        : limit,
  }
}

function rowsAt(
  sections: readonly PileupCutSection[],
  rowHeight: number,
  scroll: ScrollModel,
  limit: number,
) {
  const each = sections.map(s => sectionRows(s, rowHeight, scroll, limit))
  return {
    above: each.reduce((n, s) => n + s.above, 0),
    below: each.reduce((n, s) => n + s.below, 0),
    drawn: each.reduce((n, s) => n + s.drawn, 0),
    end: Math.min(limit, ...each.map(s => s.end)),
  }
}

/**
 * The export's pileup cut: none where every laid-out row is drawn whole and
 * the layout stacked every read, or where the box has no room for a whole row
 * over the caption line; else the rows end on the last whole row above that
 * line, which says what the figure leaves out.
 */
export function exportPileupCut(
  sections: readonly PileupCutSection[],
  rowHeight: number,
  scroll: ScrollModel,
): PileupCut {
  const box = scroll.canvasHeight
  const whole = rowsAt(sections, rowHeight, scroll, box)
  const ceiling = sections.some(s => s.ceilingClipped)
  const { above, below, drawn, end } = rowsAt(
    sections,
    rowHeight,
    scroll,
    box - CUT_CAPTION_LINE_PX,
  )
  return (whole.above + whole.below > 0 || ceiling) && drawn > 0
    ? {
        cutY: end,
        caption: [
          above > 0 ? `${above} ${pluralize(above, 'row')} above` : '',
          below > 0 ? `${below} more ${pluralize(below, 'row')} below` : '',
          ceiling ? 'deeper reads are not stacked' : '',
        ]
          .filter(part => part !== '')
          .join(' · '),
      }
    : { cutY: box, caption: '' }
}
