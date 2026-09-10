import { readConfObject } from './readConfObject.ts'

import type {
  AnyConfigurationModel,
  AnyConfigurationSnapshot,
  ConfigurationSchemaForModel,
  ConfigurationSlotName,
  ConfigurationSlotValue,
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
 * to reach its host walks into. Every such cast names a concrete schema instead
 * (`ConfigModelForFields`, or the base schema when the slot is the base's), and
 * `HostChecksSlotNames` pins each one.
 *
 * A wrong *value* type still throws at runtime (MST type-checks the assignment)
 * rather than at compile time. `value` is deliberately `unknown` because
 * `undefined` is a legitimate write — it resets a slot to its schema default —
 * and the declared slot value type doesn't include it.
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
