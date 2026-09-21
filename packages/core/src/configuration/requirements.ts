import { getConfigurationSchemaMetadata } from './schemaRegistry.ts'
import {
  isBareConfigurationSchemaType,
  isSlotDefinitionEntry,
} from './schemaTypes.ts'

import type { ConfigurationSchemaDefinition } from './configurationSchema.ts'
import type { IAnyType } from '@jbrowse/mobx-state-tree'

/**
 * A combination one config object cannot mean, declared once: when every slot
 * named in `when` holds one of the listed values, each dotted path in `slots`
 * has to name a value — a non-empty string, or a sub-schema a string lifts
 * into. `message` says why, and `id` is the stable name a report carries.
 * `requirementProblems` reads it for a display's notice, and the generated
 * JSON Schema carries it as `if`/`then` with the message, which the CLI
 * validator and an editor report.
 *
 * `ConfigurationSchema()` types `when`, its values and `slots` off the
 * definition and throws at construction for what the types cannot reach: a
 * misspelt `when` key or value would never fire, and a misspelt path would
 * require a key `closed` then refuses.
 */
export interface ConfigurationSchemaRequirement<
  WHEN extends Partial<Record<string, string[]>> = Partial<
    Record<string, string[]>
  >,
  PATH extends string = string,
> {
  id: string
  when: WHEN
  slots: PATH[]
  message: string
}

/** A requirement a snapshot does not meet: the slot path left empty, and why. */
export interface RequirementProblem {
  id: string
  slot: string
  message: string
}

function memberOf(definition: ConfigurationSchemaDefinition, name: string) {
  return Object.hasOwn(definition, name) ? definition[name] : undefined
}

function subSchemaOf(entry: unknown) {
  return isBareConfigurationSchemaType(entry)
    ? getConfigurationSchemaMetadata(entry)
    : undefined
}

function requiredPathProblem(
  modelName: string,
  definition: ConfigurationSchemaDefinition,
  path: string[],
): string | undefined {
  const [head = '', ...rest] = path
  const entry = memberOf(definition, head)
  const sub = subSchemaOf(entry)
  return entry === undefined
    ? `${modelName} declares no "${head}"`
    : rest.length > 0
      ? sub
        ? requiredPathProblem(sub.name, sub.definition, rest)
        : `"${head}" is not a single sub-schema, so no path runs through it`
      : isSlotDefinitionEntry(entry)
        ? entry.defaultValue === undefined ||
          typeof entry.defaultValue === 'string'
          ? undefined
          : `"${head}" holds no string, and a requirement is met by naming one`
        : sub?.options.shorthand !== undefined
          ? undefined
          : `"${head}" is neither a slot nor a sub-schema a string lifts into`
}

export function checkRequirements(
  modelName: string,
  definition: ConfigurationSchemaDefinition,
  requires: ConfigurationSchemaRequirement[],
) {
  for (const { when, slots } of requires) {
    for (const [slot, values = []] of Object.entries(when)) {
      const entry = memberOf(definition, slot)
      if (!isSlotDefinitionEntry(entry)) {
        throw new Error(
          `${modelName} requires something when "${slot}" holds a value, and declares no such slot`,
        )
      }
      const refused = values.filter(value => entry.model?.is(value) === false)
      if (refused.length > 0) {
        throw new Error(
          `${modelName} requires something when "${slot}" holds ${refused.join(', ')}, which the slot does not take`,
        )
      }
    }
    for (const path of slots) {
      const problem = requiredPathProblem(
        modelName,
        definition,
        path.split('.'),
      )
      if (problem) {
        throw new Error(`${modelName} requires "${path}", and ${problem}`)
      }
    }
  }
}

function namesAValue(
  definition: ConfigurationSchemaDefinition,
  snapshot: unknown,
  path: string[],
): boolean {
  const [head = '', ...rest] = path
  const value =
    typeof snapshot === 'object' && snapshot !== null
      ? (snapshot as Record<string, unknown>)[head]
      : undefined
  const sub = subSchemaOf(memberOf(definition, head))
  const shorthand = sub?.options.shorthand
  return rest.length > 0
    ? sub !== undefined && namesAValue(sub.definition, value, rest)
    : typeof value === 'string'
      ? value !== ''
      : sub !== undefined &&
        shorthand !== undefined &&
        namesAValue(sub.definition, value, [shorthand])
}

/**
 * #api core/configuration
 * The `requires` entries of a configuration schema that `snapshot` does not
 * meet, as a config file or `getSnapshot` spells it: a slot left off reads as
 * its default, so a `when` value that is the default fires for an absent slot,
 * which is what the generated JSON Schema's `if` does.
 */
export function requirementProblems(
  type: IAnyType,
  snapshot: Record<string, unknown>,
): RequirementProblem[] {
  const schema = getConfigurationSchemaMetadata(type)
  if (!schema) {
    return []
  }
  const { definition } = schema
  return (schema.options.requires ?? [])
    .filter(({ when }) =>
      Object.entries(when).every(([slot, values]) => {
        const entry = memberOf(definition, slot)
        const held =
          snapshot[slot] ??
          (isSlotDefinitionEntry(entry) ? entry.defaultValue : undefined)
        return typeof held === 'string' && values?.includes(held)
      }),
    )
    .flatMap(({ id, slots, message }) =>
      slots
        .filter(path => !namesAValue(definition, snapshot, path.split('.')))
        .map(slot => ({ id, slot, message })),
    )
}
