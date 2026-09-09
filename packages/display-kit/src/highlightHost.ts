import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { InkRect } from '@jbrowse/render-core/marks'

/** One lit box, in the chrome's px; `strong` is the chain's heavier shade. */
export interface HighlightRect extends InkRect {
  strong?: boolean
}

/**
 * How a host's hover reads: a shade over the ink (`featureHover`, the pileup
 * and the mark display), a wash with a border for a display whose cell
 * colours are the data (`hoverBoxStyle`), or a ring around a glyph.
 */
export type HighlightStyle = 'shade' | 'box' | 'ring'

/**
 * What `DisplayChrome` reads to light what a display says is hovered or
 * selected: the boxes those instances painted, which the display derives by
 * walking its mark list (`inkOfInstances`) with the instance set it names.
 * Structural, so a display gets the guide by answering `hoverInk` and nothing
 * else; the export never reads it — a hover is never exported.
 */
export interface HighlightHost extends IStateTreeNode {
  hoverInk: HighlightRect[]
  selectionInk?: HighlightRect[]
  highlightStyle?: HighlightStyle
}

export function isHighlightHost(model: object): model is HighlightHost {
  return 'hoverInk' in model
}
