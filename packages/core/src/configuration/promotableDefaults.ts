/**
 * @module
 * Session-wide "promoted defaults" for display-type config slots — the UI /
 * control layer over the read-time cascade in `promotableResolve.ts`, whose
 * `SlotResolution` every function here reads a field off. The session store
 * (`get/setDisplayTypeDefault`) holds the promoted value.
 */
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { getSession } from '../util/mstUtils.ts'
import { isObject } from '../util/objectUtils.ts'
import { fullConfSnapshot } from './fullConfSnapshot.ts'
import {
  cascadeContextFor,
  resolveSlot,
  resolveSlotIn,
} from './promotableResolve.ts'
import { promotableSlotNames } from './promotableSlots.ts'
import { isConfigurationModel } from './schemaTypes.ts'

import type { TrackConfigChange } from '../util/trackConfigDelta.ts'
import type {
  CascadeContext,
  PromotedDefaultStore,
  ResolvableDisplay,
} from './promotableResolve.ts'
import type {
  AnyConfigurationModel,
  ConfigurationSchemaForModel,
  ConfigurationSlotName,
} from './types.ts'

/**
 * #api core/configuration
 * Whether this track has customized the slot (holds a non-default value of its
 * own) rather than following the display type's default. The correct "reset to
 * default" predicate for a promotable slot: comparing the resolved value to the
 * base instead reads as at-default for a track merely *following* a non-base
 * promoted default, so the reset control lights up on a no-op.
 *
 * `SLOT` is constrained the way `getConf`'s is, and a widened `self` switches
 * the check off (`HostChecksSlotNames`). A slot name the schema does not
 * declare throws at the first read (`getSlotDefinition`), and a declared but
 * non-promotable one throws in `resolveSlotIn`.
 */
export function isSlotCustomized<
  CONFMODEL extends AnyConfigurationModel,
  SLOT extends ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>,
>(self: ResolvableDisplay<CONFMODEL>, slot: SLOT): boolean {
  return resolveSlot(self, slot).customized
}

declare const promotablesResolved: unique symbol

/**
 * #api core/configuration
 * A display config snapshot whose promotable slots hold RESOLVED values rather
 * than the inherit sentinel — what a worker payload has to be built from.
 *
 * The brand is required and unforgeable, so a plain `Record<string, unknown>`
 * is not assignable to it and neither is `getSnapshot(self.configuration)`.
 * That is the whole point. Everything downstream of the resolve is an ERASED
 * container — a snapshot is `Record<string, unknown>`, and the payload it
 * becomes is an `as`-asserted interface — so a payload builder handed the RAW
 * snapshot instead typechecks, ships `undefined` for every promotable slot, and
 * types it as the resolved value. That was measured, not supposed: the raw
 * spelling in `LinearBasicDisplay`'s `rpcProps()` passed `pnpm typecheck` and
 * every suite in `plugins/canvas`, `packages/core/src/configuration` and
 * `products/jbrowse-web`, while sending the worker `undefined` for chevrons,
 * subfeature labels and feature height.
 *
 * The rest of this subsystem's guarantees are carried by types that stay
 * connected to the schema: a raw read of a promotable `maybe*` slot is
 * `T | undefined` (see `ConfigurationSlotValue`), so `getConf` where
 * `resolveConf` was meant is a compile error at any typed consumer. The brand is
 * that guarantee re-established at the point where the connection is cut.
 */
export interface ResolvedConfigSnapshot extends Record<string, unknown> {
  readonly [promotablesResolved]: true
}

/**
 * #api core/configuration
 * The display's full config snapshot with every `promotable`
 * slot overwritten by its resolved value in place. For building a worker payload:
 * a promotable slot serializes as its raw inherit sentinel (`undefined`, since
 * they're all `maybe*` types), which the worker can't interpret — it has no
 * session to resolve against. This hands it concrete values instead, with no per-slot
 * bookkeeping, so adding a promotable worker-consumed slot needs no rpcProps
 * change and can't silently ship a sentinel. Main-thread only (the cascade
 * consults the session). Display-only promotable slots the worker never reads
 * (e.g. displayMode) are still excluded by the caller — resolving them here is a
 * harmless no-op since they're dropped anyway.
 *
 * The return type is branded (`ResolvedConfigSnapshot`) so a payload builder can
 * demand a snapshot that has been through here. The assertion below is the one
 * place the brand is applied, and it sits on the line after the resolve.
 */
export function getConfigSnapshotWithPromotables(
  self: ResolvableDisplay,
): ResolvedConfigSnapshot {
  // the unresolved walk: this is the one place allowed to snapshot a promotable
  // config, because `resolvePromotablesInto` is what resolves every such slot
  const snap = fullConfSnapshot(self.configuration)
  resolvePromotablesInto(cascadeContextFor(self), snap)
  return snap as ResolvedConfigSnapshot
}

/**
 * The subsystem's one resolve loop: every promotable slot of `ctx.config`
 * written into `snap` in place, returning the slots whose value came from a
 * promoted default rather than from the config. Both serialization boundaries
 * are this function over a different context — a display state node for the
 * worker payload, a bare display config for the About dialog's copy.
 */
function resolvePromotablesInto(
  ctx: CascadeContext,
  snap: Record<string, unknown>,
): string[] {
  const inherited: string[] = []
  for (const slot of promotableSlotNames(ctx.config)) {
    const res = resolveSlotIn(ctx, slot)
    snap[slot] = res.value
    if (res.inherited) {
      inherited.push(slot)
    }
  }
  return inherited
}

/**
 * #api core/configuration
 * A track config snapshot with every display's `promotable` slots resolved, plus
 * the list of values that came from a session-wide default rather than from the
 * config itself.
 *
 * For handing a track's config to somewhere that leaves the cascade for good —
 * the About dialog's "Copy config", whose output a user pastes into a
 * `config.json`. A raw `getSnapshot` records a slot a track merely *follows* as
 * absent (`stripDefault` collapsed it), so the copied config renders differently
 * from the track it was copied from. This is `getComputedStyle` at that
 * boundary, and `fromDisplayTypeDefaults` is what lets the UI say so rather than
 * silently materializing a session preference into a track config.
 *
 * Resolves from the display *config* alone, whether or not the track is open.
 * Everything the cascade takes is on the config node: it is the same node an
 * open display's `configuration` points at (the hydration cache makes it
 * stable), its `type` is the display type the session-wide tier is keyed on
 * (every display schema is `explicitlyTyped` under the display type's own name),
 * and the session is passed in. So an unopened track — which has no display
 * state at all — still has an answer to "what would this render as", by the same
 * code path.
 *
 * **Writes every promotable slot, including the ones sitting at `promotedBase`,
 * and that is the decision — don't "align" it with the share bake.** A pasted
 * `config.json` is read by a mechanism with no cascade in it at all, so writing
 * only the inherited values would leave every other slot to pick up whatever the
 * reader has promoted in their own browser. Pinned by
 * `products/jbrowse-web/src/tests/CopyConfigPromotedDefaults.test.ts`.
 */
export interface TrackConfigWithPromotables {
  config: Record<string, unknown>
  /** `<displayType>.<slot>`, one per value inherited from a promoted default */
  fromDisplayTypeDefaults: string[]
}

/**
 * #api core/configuration
 * See {@link TrackConfigWithPromotables}.
 */
export function getTrackConfigWithPromotables(
  session: PromotedDefaultStore,
  trackConfig: AnyConfigurationModel,
): TrackConfigWithPromotables {
  const config: Record<string, unknown> = structuredClone(
    getSnapshot(trackConfig),
  )
  const fromDisplayTypeDefaults: string[] = []
  const displayConfigs: unknown = trackConfig.displays
  const displaySnaps = config.displays
  // a config with no `displays` (an assembly, a plain customized About config)
  // has no promotable slot to resolve — every one of them is display-level
  if (Array.isArray(displayConfigs) && Array.isArray(displaySnaps)) {
    for (const [i, displayConfig] of displayConfigs.entries()) {
      const snap: unknown = displaySnaps[i]
      if (!isConfigurationModel(displayConfig) || !isObject(snap)) {
        continue
      }
      // off the live config node, not off `snap` — the snapshot is what this
      // function *writes*, so the key it resolves against shouldn't depend on
      // what survived `stripDefault` on the way out. A display schema is
      // `explicitlyTyped`, so the node always carries `type`; reading the
      // snapshot's copy meant a display whose `type` ever stopped being emitted
      // got skipped whole, and a skipped display is a copied config that
      // silently isn't flattened. Same source `cascadeContextFor` reads.
      const displayType: unknown = displayConfig.type
      if (typeof displayType === 'string') {
        const ctx = { config: displayConfig, displayType, defaults: session }
        for (const slot of resolvePromotablesInto(ctx, snap)) {
          fromDisplayTypeDefaults.push(`${displayType}.${slot}`)
        }
      }
    }
  }
  return { config, fromDisplayTypeDefaults }
}

/**
 * #api core/configuration
 * Effective differences a track following the default inherits from session-wide
 * defaults, one per promotable slot whose inherited value differs from its schema
 * default. Drives the track-selector "affected by a session default" badge.
 */
export function getDisplayTypeDefaultChanges(
  self: ResolvableDisplay,
): TrackConfigChange[] {
  const changes: TrackConfigChange[] = []
  for (const slot of promotableSlotNames(self.configuration)) {
    const res = resolveSlot(self, slot)
    if (res.inherited) {
      changes.push({
        path: [slot],
        // a cascade value is `unknown` here but JSON by contract — it has to
        // survive `postMessage` to a worker. Asserted per field rather than on
        // the whole entry, so `path` stays type-checked.
        from: res.base as TrackConfigChange['from'],
        to: res.value as TrackConfigChange['to'],
      })
    }
  }
  return changes
}

/**
 * #api core/configuration
 * Clear the named promoted defaults for this display type, so every track
 * following one reverts to its own config value. Backs the badge's "clear
 * session default" action, which passes the slots it actually listed
 * (`getDisplayTypeDefaultChanges`).
 *
 * **`slots` is required, and an all-slots default is not the convenience it
 * looks like.** It reaches further than any list a dialog can have shown: a
 * promoted default the track *customized* over is `inherited: false` and so
 * appears in no row, yet still governs sibling tracks — so clearing it from a
 * dialog that never showed
 * it moves tracks other than the one whose badge was clicked. Clearing every
 * promoted default at once is a preferences-scope action, and Preferences →
 * "Reset to defaults" is where it lives (`clearPreferenceOverrides`).
 */
export function clearPromotedDefaults(
  self: ResolvableDisplay,
  slots: Iterable<string>,
): void {
  const session = getSession(self)
  for (const slot of slots) {
    session.setDisplayTypeDefault(self.type, slot, undefined)
  }
}
