import { resolveSlot } from './promotableResolve.ts'
import { readConfObject } from './readConfObject.ts'

import type { ResolvableDisplay } from './promotableResolve.ts'
import type {
  AnyConfigurationModel,
  AnyConfigurationSnapshot,
  ConfigurationSchemaForModel,
  ConfigurationSlotName,
  ConfigurationSlotValue,
  ConfigurationSlotValueResolved,
} from './types.ts'

// Two overloads, in the same order and for the same reason as
// `readConfObject`'s: without the whole-config one, omitting `slotPath` leaves
// SLOT at its default (the union of every slot name) and the
// `SLOT extends string ? … : any` conditional below distributes over that
// union, so the declared return is a union of every slot's VALUE type rather
// than the snapshot the call actually produces. That typechecked anyway
// wherever the holder's schema was widened to `any`, which is why it survived.
// Pinning a factory's `configSchema` is what surfaces it.
/**
 * #api core/configuration
 * Reads a configuration value from a state model that has a `.configuration`
 * member (a track or display state model). For a raw configuration model, use
 * `readConfObject` instead.
 *
 * **This is exactly `readConfObject(model.configuration, path)`** — sugar for
 * the `.configuration` hop, and nothing more. The two readers carry the same
 * slot-name check, so reaching for the other one does not get a typo past tsc.
 * It does not consult the session and has no per-slot behavior; what you read is
 * what the track stores.
 *
 * A `promotable` slot read this way therefore yields the raw stored value,
 * `undefined` included — that `undefined` is the cascade's inherit sentinel, and
 * `resolveConf` is what turns it into a real value. The read type keeps the
 * `undefined` on purpose, so reaching for the wrong reader is a compile error
 * rather than a silent one.
 *
 * @param model - object containing a 'configuration' member
 * @param slotPaths - array of paths to read
 * @param args - extra arguments e.g. for a feature callback,
 *   will be sent to each of the slotNames
 */
export function getConf(model: {
  configuration: AnyConfigurationModel
}): AnyConfigurationSnapshot
export function getConf<
  CONFMODEL extends AnyConfigurationModel,
  SLOT extends
    | ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>
    | string[] = ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>,
>(
  model: { configuration: CONFMODEL },
  slotPath: SLOT,
  args?: Record<string, unknown>,
): SLOT extends string
  ? ConfigurationSlotValue<ConfigurationSchemaForModel<CONFMODEL>, SLOT>
  : any
export function getConf(
  model: { configuration: AnyConfigurationModel },
  slotPath?: string | string[],
  args: Record<string, unknown> = {},
): any {
  return readConfObject(model.configuration, slotPath, args)
}

/**
 * #api core/configuration
 * Reads a `promotable` slot through the display-type-default cascade — the
 * track's own value, else the session-wide promoted default for this display
 * type, else the slot's `promotedBase`. Always yields a real value, never the
 * `undefined` inherit sentinel, so a display's value getter is
 * `get displayMode(): DisplayMode { return resolveConf(self, 'displayMode') }`
 * with no post-guard and no cast.
 *
 * Separate from `getConf` rather than folded into it, deliberately: resolution
 * consults the session, so it is main-thread only and throws on a detached node.
 * Folding it in was built and reverted — ADR-046.
 *
 * Throws if `slot` isn't promotable — the cascade has nothing to say about a
 * plain slot, and `getConf` is what you want there.
 *
 * Takes no jexl `args`, unlike `getConf`: a promotable slot cannot hold a
 * callback (see `SlotResolution`), so there is no per-feature context to supply.
 *
 * @param model - the display state model (needs the session + display type)
 * @param slot - the promotable slot to resolve
 */
export function resolveConf<
  CONFMODEL extends AnyConfigurationModel,
  SLOT extends ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>> =
    ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>,
>(
  // the display state node itself, not just its `.configuration`: the cascade
  // keys the session-wide tier on `type` and reaches the session through the
  // node. Asking for that shape is what keeps this cast-free — hand it a bare
  // config holder and tsc names the missing members instead of failing at the
  // first read. `ResolvableDisplay<CONFMODEL>`, never
  // `ResolvableDisplay & { configuration: CONFMODEL }`: the intersection
  // re-widens the slot names to `string` (see `ResolvableDisplay`)
  model: ResolvableDisplay<CONFMODEL>,
  slot: SLOT,
): ConfigurationSlotValueResolved<
  ConfigurationSchemaForModel<CONFMODEL>,
  SLOT
> {
  // the resolution is `unknown`, which the declared return type can't infer
  return resolveSlot(model, slot).value as ConfigurationSlotValueResolved<
    ConfigurationSchemaForModel<CONFMODEL>,
    SLOT
  >
}

/**
 * #api core/configuration
 * Write counterpart to `getConf`: sets a slot on a state model that has a
 * `.configuration` member (a track or display state model).
 *
 * **Prefer this over a bare `self.configuration.setSlot('x', v)`.** The
 * constraint here mirrors `getConf`'s, so on a model with a concrete schema an
 * unknown slot name is a compile error. `setSlot` itself stays untyped on
 * purpose — the config editor's slot facade routes dynamic slot names through
 * it (`configurationSchema.ts`) — and guards the name at runtime instead
 * (ADR-052), so a misspelled write is diagnosed one way or the other.
 *
 * **The read is the half with no diagnostic at all.** `getConf` for a name the
 * schema doesn't declare returns `undefined` and reports nothing, at any layer,
 * so the slot keeps reading as its default forever. Which makes the
 * compile-time constraint worth keeping *reachable*: it is only as good as the
 * schema of the holder handed in, and a holder widened to
 * `AnyConfigurationModel` switches it off entirely — the trap a mixin casting
 * to reach its host walks into. Every such cast here names its own field table
 * instead (`ConfigModelForFields`).
 *
 * A wrong *value* type still throws at runtime (MST type-checks the assignment)
 * rather than at compile time. `value` is deliberately `unknown` because the
 * inherit sentinel (`undefined`/`null`) is a legitimate write on every
 * promotable slot, which the declared slot value type doesn't include.
 *
 * @param model - object containing a 'configuration' member
 * @param slotName - the slot to write
 * @param value - the new value
 */
export function setConf<
  CONFMODEL extends AnyConfigurationModel,
  SLOT extends ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>> =
    ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>,
>(model: { configuration: CONFMODEL }, slotName: SLOT, value: unknown) {
  // eslint-disable-next-line no-restricted-syntax -- this is setConf
  model.configuration.setSlot(slotName, value)
}
