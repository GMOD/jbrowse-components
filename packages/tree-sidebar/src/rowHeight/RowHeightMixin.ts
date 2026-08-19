import { getConf, setConf } from '@jbrowse/core/configuration'
import { resolveRowHeight } from '@jbrowse/core/util/resolveRowHeight'
import { types } from '@jbrowse/mobx-state-tree'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

// The mixin's own `self` is the empty model it declares, so it can see neither
// the `configuration` the concrete display supplies nor the `autoRowHeight` it
// computes — every display composing this is a BaseDisplay declaring both, so
// they are really there. Same idiom, and the same reason, as
// `TreeSidebarMixin`'s `confNode` and `HeightModeMixin`'s `heightHost`.
const rowHost = (self: object) =>
  self as { configuration: AnyConfigurationModel; autoRowHeight: number }

/**
 * #stateModel RowHeightMixin
 * #category display
 * #crossCuttingMixin The two-valued row height every multi-row display has. A `rowHeightConfigSchemaFields` slot whose `0` means fit-to-display-height, and an `autoRowHeight` getter saying what that fit divides. Brings the raw `rowHeight` getter, `setRowHeight`, and the resolved `effectiveRowHeight` every consumer reads
 *
 * The convention itself is
 * agent-docs/reference/ROW_HEIGHT_AND_FIT.md; this is the middle link of it.
 * **Both ends were already shared**: `rowHeightMenuItem` and
 * `SetRowHeightDialog` in this directory are the one menu row and dialog for
 * every row display, and `resolveRowHeight` in core is the one place the `0`
 * sentinel resolves and a non-positive result is floored. What sat between them
 * was three hand-written copies — maf, the multi-row feature painting and the
 * multi-sample variant base — of the slot, the getter over it and the setter.
 *
 * **This package already depended on members it did not declare.**
 * `rowHeightMenu` restates `rowHeight` / `setRowHeight` / `setFitToHeight` as
 * `RowHeightModel` and `types.ts`'s `TreeDrawingModel` restates
 * `effectiveRowHeight`, so a display wiring in the shared menu and spelling one
 * of them differently compiled and then failed at the first click. Slots and
 * accessors now move together, matching `treeSidebarConfigSchemaFields` +
 * `TreeSidebarMixin`.
 *
 * **What stays per display is what genuinely differs**, and the doc says which:
 * `autoRowHeight`, because the height available to rows is a different quantity
 * in each (canvas's `fitTargetHeight`, maf's `rowsHeight`, variants'
 * `availableHeight`), and `setFitToHeight`, because seeding the `height` slot on
 * the way in is required exactly where the `height` getter is content-derived
 * and wrong where it is the slot itself.
 *
 * `effectiveRowHeight` is overridable, and one display overrides it: the
 * multi-row feature painting caps the row stack at the canvas limit, since it
 * sizes its canvas to its content instead of scrolling a viewport.
 */
export function RowHeightMixin() {
  return types
    .model('RowHeightMixin', {})
    .views(self => ({
      /**
       * #getter
       * Raw per-row height setting: `0` is fit-to-display-height, any positive
       * value is a fixed px height. The resolved value is
       * `effectiveRowHeight` — consumers read that, never this. On the config
       * rather than the display snapshot for the same reason `height` is: the
       * config node outlives the display instance, so a fixed height survives
       * unticking and reticking the track.
       */
      get rowHeight(): number {
        return getConf(rowHost(self), 'rowHeight')
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Resolved per-row height. `rowHeight === 0` divides the display's own
       * `autoRowHeight` across the rows; any positive value is the fixed px
       * height, used as-is however many rows there are.
       *
       * Sub-pixel is legitimate and deliberately not floored here — a cohort
       * with more rows than the track has pixels has a genuinely fractional row
       * height, and flooring it makes the content taller than the height it was
       * asked to fit inside. `resolveRowHeight` floors only a **non-positive**
       * result, which consumers divide by.
       */
      get effectiveRowHeight(): number {
        return resolveRowHeight(self.rowHeight, rowHost(self).autoRowHeight)
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Pin a px row height. `0` is the fit sentinel, but enter fit mode
       * through `setFitToHeight` instead — displays whose `height` getter is
       * content-derived have to re-seed the slot on the way in, and that is
       * what the action is for.
       */
      setRowHeight(n: number) {
        setConf(rowHost(self), 'rowHeight', n)
      },
    }))
}
