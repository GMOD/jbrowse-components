import { promotableSlotNames, resolveSlot } from './promotableResolve.ts'
import { readConfObject } from './util.ts'

import type { PromotableDisplay } from './promotableResolve.ts'
import type {
  AnyConfigurationModel,
  ConfigurationSchemaForModel,
  ConfigurationSlotName,
  ConfigurationSlotValue,
} from './types.ts'

/**
 * #api core/configuration
 * Reads a configuration value from a state model that has a `.configuration`
 * member (a track or display state model). For a raw configuration model, use
 * `readConfObject` instead.
 *
 * A `promotable` slot is resolved through the display-type-default cascade
 * (track value -> session-wide promoted default -> base) rather than read raw,
 * so a display's own value getter can be a plain `getConf(self, 'slot')` and
 * still follow the cascade — and can never surface a slot's inherit sentinel.
 * That resolution is main-thread only (it consults the session); the worker
 * reads plain config snapshots through `readConfObject`, which stays raw. See
 * `promotableResolve.ts`.
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
  if (
    typeof slotPath === 'string' &&
    promotableSlotNames(model.configuration).has(slotPath)
  ) {
    // a promotable slot resolves through the cascade. `model` is the display
    // state node the resolver needs (type + session + ignorePromotedDefaults);
    // only display state models carry a schema with promotable slots, so this
    // branch is reached for exactly those. `args` are forwarded so a promotable
    // slot holding a jexl callback evaluates with the caller's context, exactly
    // as a plain slot read would. The cast matches the declared return (this is
    // the `SLOT extends string` case); `resolveSlot(...).value` is `unknown`,
    // which the conditional return type can't infer on its own.
    return resolveSlot(model as unknown as PromotableDisplay, slotPath, args)
      .value as SLOT extends string
      ? ConfigurationSlotValue<ConfigurationSchemaForModel<CONFMODEL>, SLOT>
      : any
  }
  return readConfObject(model.configuration, slotPath, args)
}

/**
 * #api core/configuration
 * Write counterpart to `getConf`: sets a slot on a state model that has a
 * `.configuration` member (a track or display state model). Centralizes the
 * `configuration.setSlot` cast so mixins whose `self` isn't typed with
 * `configuration` don't each re-cast.
 *
 * @param model - object containing a 'configuration' member
 * @param slotName - the slot to write
 * @param value - the new value
 */
export function setConf<
  CONFMODEL extends AnyConfigurationModel,
  SLOT extends
    | ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>
    | string = ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>,
>(model: { configuration: CONFMODEL }, slotName: SLOT, value: unknown) {
  ;(
    model.configuration as CONFMODEL & {
      setSlot: (slotName: string, value: unknown) => void
    }
  ).setSlot(slotName, value)
}
