import { getType } from '@jbrowse/mobx-state-tree'

import { readConfObject } from './readConfObject.ts'
import { getConfigurationSchemaDefinition } from './schemaRegistry.ts'
import {
  isConfigurationModel,
  isConfigurationSchemaType,
} from './schemaTypes.ts'

import type {
  AnyConfigurationModel,
  AnyConfigurationSnapshot,
  ConfigurationSchemaForModel,
  ConfigurationSlotName,
  ConfigurationSlotPath,
  ConfigurationSlotPathValue,
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
  const SLOT extends
    | ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>
    | ConfigurationSlotPath<ConfigurationSchemaForModel<CONFMODEL>> =
    ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>,
>(
  model: { configuration: CONFMODEL },
  slotPath: SLOT,
  args?: Record<string, unknown>,
): SLOT extends string
  ? ConfigurationSlotValue<ConfigurationSchemaForModel<CONFMODEL>, SLOT>
  : ConfigurationSlotPathValue<ConfigurationSchemaForModel<CONFMODEL>, SLOT>
export function getConf(
  model: { configuration: AnyConfigurationModel },
  slotPath?: string | string[],
  args: Record<string, unknown> = {},
): any {
  return readConfObject(model.configuration, slotPath, args)
}

/**
 * #api core/configuration
 * Write counterpart to `getConf`, and it takes the same path: a slot name, or
 * an array naming a sub-schema's member at any depth —
 * `setConf(self, ['scales', 'y', 'domainMin'], 5)`. Takes the display or track
 * model, or a config node directly.
 *
 * **The path length says what the write replaces.** A path ending on a slot
 * writes that slot and leaves the object around it alone; a path ending on a
 * sub-schema replaces the whole object, which is how a channel whose members
 * move together — a facet's field and the domain that field's values order —
 * gets written without a stale member surviving underneath.
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
 * @param target - a model with a `configuration` member, or a config node
 * @param slotPath - the slot to write, or the path to one
 * @param value - the new value
 */
export function setConf<
  CONFMODEL extends AnyConfigurationModel,
  const SLOT extends
    | ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>
    | ConfigurationSlotPath<ConfigurationSchemaForModel<CONFMODEL>> =
    ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>,
>(
  target: CONFMODEL | { configuration: CONFMODEL },
  slotPath: SLOT,
  value: unknown,
): void {
  writeConfPath(
    isConfigurationModel(target) ? target : target.configuration,
    typeof slotPath === 'string' ? [slotPath] : (slotPath as string[]),
    value,
  )
}

/**
 * Walk to the node the last segment names a member of, then write that member
 * through whichever of the node's two write actions the member is: a
 * sub-schema, single or a collection, is replaced whole, and a slot goes
 * through `setSlot` so ADR-052's name guard and the value-type guard both run.
 * MST's `applyPatch` takes the same path and runs neither guard.
 */
function writeConfPath(
  conf: AnyConfigurationModel,
  path: readonly string[],
  value: unknown,
) {
  if (!path.length) {
    throw new Error('setConf needs a slot name or a path to one')
  }
  let node = conf
  for (const segment of path.slice(0, -1)) {
    const child = (node as unknown as Record<string, unknown>)[segment]
    if (!isConfigurationModel(child)) {
      throw new Error(
        `${getType(node).name} has no sub-schema "${segment}", so ${path.join('.')} names nothing to write`,
      )
    }
    node = child
  }
  const leaf = path.at(-1)!
  // Classify off the declaration, never off what the member holds: a
  // `stringArray` slot holds an array node, and an optional sub-schema nobody
  // has written yet holds nothing.
  const declared = getConfigurationSchemaDefinition(node)?.[leaf]
  if (isConfigurationSchemaType(declared)) {
    // eslint-disable-next-line no-restricted-syntax -- this is setConf
    node.setSubschema(leaf, value)
  } else {
    // eslint-disable-next-line no-restricted-syntax -- this is setConf
    node.setSlot(leaf, value)
  }
}
