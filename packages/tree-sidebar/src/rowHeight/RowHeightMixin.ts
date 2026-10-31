import { getConf, setConf } from '@jbrowse/core/configuration'
import { resolveRowHeight } from '@jbrowse/core/util/resolveRowHeight'
import { types } from '@jbrowse/mobx-state-tree'

import type { RowHeightConfigModel } from './rowHeightConfigSchemaFields.ts'

/**
 * The whole of what `RowHeightMixin` needs a composing display to be. Exported
 * because it is the mixin's contract and `RowHeightMixin.test.ts` pins it:
 * widen it and the `@ts-expect-error`s there go unused, which `pnpm typecheck`
 * fails.
 */
export interface RowHeightHost {
  configuration: RowHeightConfigModel
}

// The mixin's own `self` is the empty model it declares, so it cannot see the
// `configuration` the concrete display supplies — every display composing this
// is a BaseDisplay, so it is really there. Same idiom, and the same reason, as
// `TreeSidebarMixin`'s and `ScoreScaleMixin`'s `confNode`. What it is narrowed
// **to** is the part worth copying: the sibling slot table rather than
// `AnyConfigurationModel`, so the reads and writes below still get their slot
// name checked.
const confNode = (self: object) => self as RowHeightHost

/**
 * #stateModel RowHeightMixin
 * #category display
 * #crossCuttingMixin The two-valued row height every multi-row display has. A `rowHeightConfigSchemaFields` slot whose `0` means fit-to-display-height, and an `autoRowHeight` getter saying what that fit divides. Brings the raw `rowHeight` getter, `setRowHeight`, and the resolved `effectiveRowHeight` every consumer reads
 *
 * The convention itself is
 * agent-docs/reference/ROW_HEIGHT_AND_FIT.md; this is the middle link of it.
 * `rowHeightMenuItem` and `SetRowHeightDialog` in this directory are the one
 * menu row and dialog for every row display, and `resolveRowHeight` in core is
 * the one place the `0` sentinel resolves and a non-positive result is floored.
 * This mixin sits between them, in place of hand-written copies — the
 * multi-row feature painting and the multi-sample variant base — of the slot,
 * the getter over it and the setter. MAF is always-fit and composes none of it.
 *
 * **The mixin declares the members this package depends on.**
 * `rowHeightMenu` restates `rowHeight` / `setRowHeight` / `setFitToHeight` as
 * `RowHeightModel` and `types.ts`'s `TreeDrawingModel` restates
 * `effectiveRowHeight`, so a display wiring in the shared menu and spelling one
 * of them differently would compile and then fail at the first click. Slots and
 * accessors move together, matching `rowAxisConfigSchema` + `TreeSidebarMixin`.
 *
 * **What stays per display is the value, not the declaration.** The per-display
 * members are `autoRowHeight`, because the height available to rows is a different
 * quantity in each (the mark display's plot, variants' `availableHeight`), and `setFitToHeight`, because seeding the `height` slot on
 * the way in is required exactly where the `height` getter is content-derived
 * and wrong where it is the slot itself.
 *
 * `effectiveRowHeight` is overridable, and one display overrides it: the mark
 * display honours a pinned `rowHeight` only while it draws rows.
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
        return getConf(confNode(self), 'rowHeight')
      },
      /**
       * #getter
       * The height fit mode divides between the rows, declared here and
       * **overridden by every display** — the quantity differs in each, so this
       * stub is a slot for the answer rather than an answer. Declaring it
       * lets `effectiveRowHeight` below read a member with a declared type
       * instead of one asserted onto `self`.
       *
       * A display that composes the mixin and supplies no override resolves to
       * a 1px row, the same as when the read finds `undefined`:
       * `resolveRowHeight` floors both.
       *
       * Supply it as a **getter**, the way all three displays do. Mobx refuses
       * to write a volatile over a computed, so a `.volatile` of this name
       * throws at `create` — loudly, and before any row is drawn.
       */
      get autoRowHeight(): number {
        return 0
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
        return resolveRowHeight(self.rowHeight, self.autoRowHeight)
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
        setConf(confNode(self), 'rowHeight', n)
      },
    }))
}
