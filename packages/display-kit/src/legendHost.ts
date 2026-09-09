import type { LegendSpec } from '@jbrowse/core/ui/legendSpec'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * What the two chrome shells read to draw a display's legend: the members
 * `LegendMixin` brings, named structurally so `DisplayChrome` and
 * `renderDisplaySvg` can detect the mixin on any model handed to them without
 * importing it.
 */
export interface LegendHost extends IStateTreeNode {
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
  /** Px from the top of the display box the key starts at, on both surfaces. */
  legendTop?: number
}

export function isLegendHost(model: object): model is LegendHost {
  return 'legendSpec' in model && 'showLegend' in model
}
