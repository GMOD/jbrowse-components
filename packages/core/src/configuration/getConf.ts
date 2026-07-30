import { resolveSlot } from './promotableResolve.ts'
import { readConfObject } from './util.ts'

import type { ResolvableDisplay } from './promotableResolve.ts'
import type {
  AnyConfigurationModel,
  ConfigurationSchemaForModel,
  ConfigurationSlotName,
  ConfigurationSlotValue,
  ConfigurationSlotValueResolved,
} from './types.ts'

/**
 * #api core/configuration
 * Reads a configuration value from a state model that has a `.configuration`
 * member (a track or display state model). For a raw configuration model, use
 * `readConfObject` instead.
 *
 * **This is exactly `readConfObject(model.configuration, path)`** — sugar for
 * the `.configuration` hop, plus a stricter slot-name check (see ./CLAUDE.md).
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
export function getConf<
  CONFMODEL extends AnyConfigurationModel,
  SLOT extends
    | ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>
    | string[] = ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>,
>(
  model: { configuration: CONFMODEL },
  slotPath?: SLOT,
  args: Record<string, unknown> = {},
): SLOT extends string
  ? ConfigurationSlotValue<ConfigurationSchemaForModel<CONFMODEL>, SLOT>
  : any {
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
 * Separate from `getConf` rather than folded into it, deliberately. Resolution
 * is not free and not universal: it consults the session (so it's main-thread
 * only, and throws on a detached node) and it means something only for the ~15
 * promotable slots out of 1300-odd config reads in the repo. Hiding it inside
 * `getConf` made every one of those reads a maybe-cascade whose behavior you
 * couldn't see at the call site and which turned on a `promotable: true` flag in
 * another file. Naming it at the call site costs one word and restores
 * `getConf` to being what everyone already believed it was.
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
  // keys the session-wide tier on `type` and honours `ignorePromotedDefaults`.
  // Asking for that shape is what keeps this cast-free — hand it a bare config
  // holder and tsc names the missing members instead of failing at the first read
  model: ResolvableDisplay & { configuration: CONFMODEL },
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
 * `.configuration` member (a track or display state model). Centralizes the
 * `configuration.setSlot` cast so mixins whose `self` isn't typed with
 * `configuration` don't each re-cast.
 *
 * **Prefer this over a bare `self.configuration.setSlot('x', v)`.** The
 * constraint here mirrors `getConf`'s, so on a model with a concrete schema an
 * unknown slot name is a compile error. The raw `setSlot` action takes a plain
 * `string`, and a typo there fails *completely silently*: the assignment lands
 * on an undeclared property, so nothing throws, nothing persists, and the
 * matching `getConf` read keeps returning the default. That is the one config
 * mistake with no diagnostic at any layer. `setSlot` itself stays untyped on
 * purpose. The config editor's slot facade routes dynamic slot names through it
 * (`configurationSchema.ts`).
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
  ;(
    model.configuration as CONFMODEL & {
      setSlot: (slotName: string, value: unknown) => void
    }
  ).setSlot(slotName, value)
}
