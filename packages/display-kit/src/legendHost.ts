import type { LegendSpec } from '@jbrowse/core/ui/legendSpec'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
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
  /** `legendSpec` in the export's theme, for a key whose colors follow it. */
  legendSpecIn?(palette: JBrowsePalette): LegendSpec
  setShowLegend(arg: boolean): void
  dismissLegendSection(id: string): void
  /**
   * A display whose key rows act answers this for the scales it declared with
   * `focusesRows`; a click on one of their entries focuses the rows it names.
   */
  focusLegendEntry?(scaleId: string, value: string): void
  /** Width the LGV export reserves beside the plot for this legend, 0 to float it over the plot. */
  svgLegendWidth?(): number
  /** Px the on-screen key is pushed down from its own inset, clearing a control there. */
  legendTop?: number
  /** Px the on-screen key is pushed left from its own inset, clearing a column of text there. */
  legendRight?: number
  /**
   * A ceiling on the on-screen box's width, for a vocabulary whose labels
   * genuinely need the words; the export measures its own.
   */
  legendMaxWidth?: number
}

export function isLegendHost(model: object): model is LegendHost {
  return 'legendSpec' in model && 'showLegend' in model
}
