import type { LegendSpec } from '@jbrowse/core/ui/legendSpec'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * What the two chrome shells read to draw a display's legend: the members
 * `LegendMixin` brings, named structurally so `DisplayChrome` and
 * `renderDisplaySvg` can detect the mixin on any model handed to them without
 * importing it.
 */
export interface LegendHost extends IStateTreeNode {
  id: string
  showLegend: boolean
  legendSpec: LegendSpec
  setShowLegend(arg: boolean): void
  dismissLegendSection(id: string): void
  /**
   * A display whose key rows act — a row naming a group of rows focuses them —
   * answers this; without it the rows are inert.
   */
  focusLegendEntry?(scaleId: string, value: string): void
  /** Width the LGV export reserves beside the plot for this legend, 0 to float it over the plot. */
  svgLegendWidth?(): number
  /** Px the key is pushed down from its own inset, on both surfaces. */
  legendTop?: number
  /**
   * A ceiling on the on-screen box's width, for a vocabulary whose labels
   * genuinely need the words; the export measures its own.
   */
  legendMaxWidth?: number
}

export function isLegendHost(model: object): model is LegendHost {
  return 'legendSpec' in model && 'showLegend' in model
}
