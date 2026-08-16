// own module, not the configuration barrel: that barrel re-exports modules
// which import this one, and a value import back into it is the cycle shape
// `openFeatureWidget` documents
import { getConf } from '../configuration/getConf.ts'
import { ensureJexlPrefix } from './jexlStrings.ts'

import type { Reversible } from '../ui/filterMenuItems.ts'

/**
 * The two-tier feature-filter contract, shared by every display offering a
 * "Filter by..." row. Two tiers because the setting has two authors:
 *
 * - the **`jexlFilters` config slot** on `baseLinearDisplayConfigSchema`, which
 *   an admin declares in a track config. It stores expressions **unprefixed**,
 *   because config-slot values are deferred-evaluation and a stored `jexl:` is
 *   what marks a slot as a callback — so the prefix goes on at read time, in
 *   `configuredJexlFilters`.
 * - the **`jexlFiltersSetting` display property**, which the dialog writes and
 *   which stores them already prefixed (the runtime convention). Set — *even to
 *   an empty list* — it replaces the config tier entirely, which is what makes
 *   "clear the filters an admin declared" expressible.
 *
 * Every display implemented one half of this and a different half each:
 * `LinearBasicDisplay` had both tiers, `LDDisplay` had the slot alone, and the
 * multi-sample variant displays had a property literally named `jexlFilters`
 * that shadowed the inherited slot, so a config filter on one of those tracks
 * was read by nothing and reported no error. Neither of the last two prefixed,
 * so a filter following the slot's own documented convention reached
 * `stringToJexlExpression` unprefixed and threw inside the worker.
 */
export interface JexlFilterSource {
  /**
   * The dialog's override, `jexl:`-prefixed. `undefined` means "follow the
   * config slot"; an empty array means "the user cleared them".
   */
  jexlFiltersSetting?: readonly string[]
  /**
   * The config tier, `jexl:`-prefixed — in practice
   * `configuredJexlFilters(self)`. A member rather than a read this module does
   * itself, so the two things that consume this contract off a **duck-typed**
   * model — LD's structural menu builder and its shape test — need no live
   * config node to answer a count with.
   */
  configuredFilters: () => string[]
}

/**
 * The writing half, for the dialog and the menu's clear row. Separate from
 * {@link JexlFilterSource} because a display declares `activeFilters()` in an
 * earlier `.views()` block than the `.actions()` block declaring its setter, so
 * requiring the setter to *read* the filters would put the two in an order MST
 * cannot satisfy.
 */
export interface JexlFilterModel extends JexlFilterSource {
  setJexlFilters: (filters?: string[]) => void
}

/**
 * What the `jexlFilters` config slot alone declares, `jexl:`-prefixed. The slot
 * stores them unprefixed and every runtime consumer wants them prefixed, so the
 * prefixing happens once, here — this is what a display's `configuredFilters`
 * member is.
 */
export function configuredJexlFilters(
  self: Parameters<typeof getConf>[0],
): string[] {
  return getConf(self, 'jexlFilters').map(ensureJexlPrefix)
}

/**
 * The filters actually applied, `jexl:`-prefixed — the single source of truth
 * for the worker (via `rpcProps`), for the "Filter by..." dialog (so config
 * filters show up and are editable), and for the narrowing count below.
 */
export function activeJexlFilters(self: JexlFilterSource): string[] {
  const { jexlFiltersSetting } = self
  return jexlFiltersSetting ? [...jexlFiltersSetting] : self.configuredFilters()
}

/**
 * The `Reversible` a display declares for its jexl filters.
 *
 * The count is whether the override **differs from the configured baseline**,
 * not the number of expressions: a filter an admin declared is not something
 * the user narrowed, and "Clear all filters" could not undo it anyway. It
 * counts in both directions when they differ — narrowing further, and (emptied
 * over a slot that declares filters) widening past what the config asked for.
 *
 * No per-item row: a list of jexl expressions has no recovery to name beyond
 * restoring the config default, which the group clear already is.
 */
export function jexlFilterNarrowing(self: JexlFilterModel): Reversible {
  const override = self.jexlFiltersSetting
  const configured = self.configuredFilters()
  return {
    count:
      override !== undefined &&
      (override.length !== configured.length ||
        override.some((f, i) => ensureJexlPrefix(f) !== configured[i]))
        ? 1
        : 0,
    clear: () => {
      self.setJexlFilters(undefined)
    },
  }
}
