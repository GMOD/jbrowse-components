import { toLocale } from '@jbrowse/core/util'

import { attributeTooltipLines } from './attributeTooltipLines.ts'

/**
 * One side of an alignment, as the tooltip names it: an axis on a dotplot, a
 * row on a stacked synteny view.
 *
 * `loc` arrives assembled rather than as coordinates, because the two views
 * resolve it from different places — the dotplot reads it back out of the drawn
 * cumBp endpoints, the synteny display has the feature itself. Both go through
 * `assembleLocString`, so both print the same 1-based convention as every other
 * coordinate in the app.
 */
export interface ComparativeTooltipSide {
  // how this view names the side: 'x'/'y' on a dotplot, 'Loc1'/'Loc2' stacked
  label: string
  // how it names that side's length, when the side's own name won't do:
  // 'Query'/'Target' say which assembly, where a bare 'Loc1 len' doesn't
  lengthLabel?: string
  loc: string
  length: number
}

/**
 * The hover tooltip both comparative views show for one alignment, as LINES.
 *
 * Lines rather than an HTML string: a refName and a feature name both come out
 * of an alignment file and can hold anything, and `ComparativeTooltip` renders
 * these as text nodes, so nothing here has to be sanitized on the way to the
 * screen.
 *
 * Shared because the two had drifted twice. First the numeric channels, which
 * is what `attributeTooltipLines` below was pulled out for; then the locations,
 * where the dotplot's hand-rolled `{asm}refName:start-end` printed the interbase
 * start while the synteny side's `assembleLocString` printed the 1-based one.
 * What is left per view is the two side labels, which genuinely differ — the
 * axes of a plot against the rows of a stack.
 */
export function comparativeTooltipLines({
  sides,
  inverted,
  attributes,
  cigarOp,
  name,
}: {
  sides: [ComparativeTooltipSide, ComparativeTooltipSide]
  inverted: boolean
  attributes: Record<string, number>
  // The operator under the CURSOR, resolved from the hovered segment rather
  // than the feature — one alignment's CIGAR staircase is many segments, and
  // the pointer can be on different steps of it. Undefined for a match, and for
  // every zoomed-out alignment with no detail drawn.
  cigarOp?: { op: string; length: number }
  name?: string
}) {
  return [
    ...sides.map(s => `${s.label}: ${s.loc}`),
    `Inverted: ${inverted}`,
    ...sides.map(
      s => `${s.lengthLabel ?? `${s.label} len`}: ${toLocale(s.length)}`,
    ),
    ...attributeTooltipLines(attributes),
    cigarOp ? `CIGAR operator: ${toLocale(cigarOp.length)}${cigarOp.op}` : '',
    // Last because it is the line most tracks don't have: a PAF names no
    // feature at all.
    name ? `Name: ${name}` : '',
  ].filter(Boolean)
}
