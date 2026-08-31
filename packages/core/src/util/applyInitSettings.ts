import { applyPatch, getPropertyMembers } from '@jbrowse/mobx-state-tree'

import type {
  IAnyModelType,
  IStateTreeNode,
  SnapshotIn,
} from '@jbrowse/mobx-state-tree'

/**
 * A view's init type, derived: the keys its launcher interprets (`Commands`)
 * plus every declared property of its state model, optional, in the property's
 * own snapshot type. Nothing is restated, so a property is authorable — and
 * TYPED — from the line that declares it.
 *
 * ```ts
 * export type LinearSyntenyViewInit = ViewInit<
 *   LinearSyntenyViewStateModel,
 *   LinearSyntenyViewCommands
 * >
 * ```
 *
 * THE ONE RULE THIS DEPENDS ON: the model's own `init` property must be typed
 * as the `Commands`, not as this. `init` is a property, so an `init` typed as
 * the whole thing makes the whole thing depend on itself — TS7023 on the
 * factory, then implicit-any across every file that touches the view (ADR-055,
 * same failure the view/display instance pair has). Commands never mention the
 * model, so typing `init` as those breaks the loop, and it costs nothing: the
 * view's own code reads the commands out of `self.init`, and the settings half
 * is read only by `applyInitSettings`, which asks the model rather than a type.
 */
export type ViewInit<M extends IAnyModelType, Commands> = Commands &
  Partial<Omit<SnapshotIn<M>, keyof Commands | (typeof RESERVED_KEYS)[number]>>

// Keys that are a view's identity or its plumbing rather than a setting. A
// launch spec never gets to write these: `type` picks the view, `id` is passed
// top-level so MST's optional identifier honors it, `launch` is the blob
// `withLaunchInput`'s partition fills, and `init` inside `init` is the nesting
// mistake loadSessionSpec already reports.
export const RESERVED_KEYS = ['id', 'type', 'init', 'launch'] as const
const RESERVED: ReadonlySet<string> = new Set(RESERVED_KEYS)

export interface InitSettingsReport {
  /** keys applied, in the order they were found */
  applied: string[]
  /** keys naming no declared property — a typo, or a prop that never existed */
  unknown: string[]
  /** declared keys whose value the property's own type rejected */
  invalid: string[]
}

/**
 * Apply the plain-settings half of an `init` blob: every key naming a declared
 * MST property of `self` is written straight to it, and the caller handles only
 * the keys it names in `commands`.
 *
 * THE POINT IS THAT THERE IS NO PER-SETTING CODE. A view used to need a
 * hand-written `if (init.x !== undefined) self.setX(init.x)` arm per property,
 * so a new toggle worked from its menu the moment it was declared and was
 * dropped in silence from every authored surface — a session spec, a share
 * link, a config `defaultSession` — until someone remembered the second edit.
 * Nobody did: `drawLocationMarkers` shipped unauthorable, and DotplotView's
 * `alpha`/`drawCigar`/`lineWidth`/`lockAspectRatio` never had an arm at all.
 * Reading the property list off the model at runtime means declaring the
 * property IS declaring it authorable, including properties a composed mixin
 * brings in (colorBy, showColorLegend), and there is nothing left to keep in
 * sync.
 *
 * `commands` is what a launcher genuinely has to interpret: keys with no
 * property behind them (`loc`, `autoDiagonalize`), keys whose name collides
 * with a property meaning something else (a spec's `views` is a list of
 * assemblies to open; the model's `views` is the built rows), and keys with an
 * ordering constraint (`levelHeights` must land after the auto-scale pass).
 * Listing one is a decision to write code for it; everything else needs none.
 *
 * WRITTEN AS A PATCH, not through `setX`. Applying init is state restoration,
 * and the authority on that is MST: `applyPatch` validates each value against
 * the property's own type and touches nothing else, where `applySnapshot`
 * would rebuild the view's children. That it skips the setters is correct
 * rather than a shortcut — a session reload restores the same state from a
 * snapshot and calls no setters either, so a property needing a setter's side
 * effect to be correct is already broken on reload, and the effect belongs in a
 * reaction on the property.
 *
 * A value the property's type rejects is dropped and reported rather than
 * thrown: init blobs come from URLs, and one bad number should not cost the
 * reader the whole view.
 */
export function applyInitSettings(
  self: IStateTreeNode,
  // `object` rather than a keyed record: an init blob's static type is the
  // view's own `ViewInit`, which has named members and no index signature — by
  // design, so a typo is a compile error there — and that is not assignable to
  // `Record<string, unknown>`. This reads it by enumeration anyway.
  init: object | undefined,
  { commands = [] }: { commands?: readonly string[] } = {},
): InitSettingsReport {
  const report: InitSettingsReport = { applied: [], unknown: [], invalid: [] }
  if (!init) {
    return report
  }
  const skip = new Set(commands)
  const { properties } = getPropertyMembers(self)
  const patch = []

  for (const [key, value] of Object.entries(init)) {
    if (skip.has(key) || RESERVED.has(key) || value === undefined) {
      continue
    }
    const propType = properties[key]
    if (!propType) {
      report.unknown.push(key)
    } else if (!propType.is(value)) {
      report.invalid.push(key)
    } else {
      patch.push({ op: 'replace' as const, path: `/${key}`, value })
      report.applied.push(key)
    }
  }

  if (patch.length) {
    applyPatch(self, patch)
  }
  return report
}

/**
 * Say what `applyInitSettings` refused, naming the surface. Split from the
 * apply so a caller under test can assert the report without a console, and so
 * the two messages read the same wherever they come from.
 */
export function warnInitSettings(surface: string, report: InitSettingsReport) {
  if (report.unknown.length) {
    console.warn(
      `${surface} ignored unknown key(s): ${report.unknown.join(', ')}`,
    )
  }
  if (report.invalid.length) {
    console.warn(
      `${surface} ignored key(s) with an invalid value: ${report.invalid.join(', ')}`,
    )
  }
}
