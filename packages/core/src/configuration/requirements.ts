import { isPlainObject } from '../util/objectUtils.ts'
import {
  declaredMember,
  getConfigurationSchemaMetadata,
} from './schemaRegistry.ts'
import {
  isBareConfigurationSchemaType,
  isSlotDefinitionEntry,
  shorthandTargets,
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
  const entry = declaredMember(definition, head)
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
      const entry = declaredMember(definition, slot)
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
  const sub = subSchemaOf(declaredMember(definition, head))
  const named = sub && shorthandTargets(sub).string
  return rest.length > 0
    ? sub !== undefined && namesAValue(sub.definition, value, rest)
    : typeof value === 'string'
      ? value !== ''
      : sub !== undefined &&
        named !== undefined &&
        namesAValue(sub.definition, value, [named])
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
    .filter(({ when }) => whenHolds(definition, when, snapshot))
    .flatMap(({ id, slots, message }) =>
      slots
        .filter(path => !namesAValue(definition, snapshot, path.split('.')))
        .map(slot => ({ id, slot, message })),
    )
}

function refusedPathProblem(
  modelName: string,
  definition: ConfigurationSchemaDefinition,
  path: string[],
): string | undefined {
  const [head = '', ...rest] = path
  const entry = declaredMember(definition, head)
  const sub = subSchemaOf(entry)
  return entry === undefined
    ? `${modelName} declares no "${head}"`
    : rest.length > 0
      ? sub
        ? refusedPathProblem(sub.name, sub.definition, rest)
        : `"${head}" is not a single sub-schema, so no path runs through it`
      : undefined
}

export function checkRefusals(
  modelName: string,
  definition: ConfigurationSchemaDefinition,
  refuses: ConfigurationSchemaRequirement[],
) {
  checkRequirements(
    modelName,
    definition,
    refuses.map(rule => ({ ...rule, slots: [] })),
  )
  for (const { slots } of refuses) {
    for (const path of slots) {
      const problem = refusedPathProblem(modelName, definition, path.split('.'))
      if (problem) {
        throw new Error(`${modelName} refuses "${path}", and ${problem}`)
      }
    }
  }
}

function holdsAValue(value: unknown) {
  return Array.isArray(value)
    ? value.length > 0
    : typeof value === 'object' && value !== null
      ? Object.keys(value).length > 0
      : value !== undefined && value !== null && value !== ''
}

function valueAt(snapshot: unknown, path: readonly string[]): unknown {
  const [head = '', ...rest] = path
  const value = isPlainObject(snapshot) ? snapshot[head] : undefined
  return rest.length > 0 ? valueAt(value, rest) : value
}

function whenHolds(
  definition: ConfigurationSchemaDefinition,
  when: Partial<Record<string, string[]>>,
  snapshot: Record<string, unknown>,
) {
  return Object.entries(when).every(([slot, values]) => {
    const entry = declaredMember(definition, slot)
    const held =
      snapshot[slot] ??
      (isSlotDefinitionEntry(entry) ? entry.defaultValue : undefined)
    return typeof held === 'string' && values?.includes(held)
  })
}

/**
 * A refusal's `message` with each `{slot}` placeholder filled with the value
 * `snapshot` gives that slot, so one rule over several values names the one
 * written: `field '{field}' names a row`.
 */
export function filledMessage(
  message: string,
  snapshot: Record<string, unknown>,
) {
  return message.replaceAll(/\{(\w+)\}/g, (placeholder, slot: string) => {
    const value = snapshot[slot]
    return typeof value === 'string' ? value : placeholder
  })
}

/**
 * The `refuses` entries of a schema that `snapshot` breaks: a dotted path
 * holding a value (a non-empty string, list or object) while every slot named
 * in `when` holds one of the listed values, its default counting while
 * unwritten, as `requirementProblems` reads `when`.
 */
export function refusalProblems(
  schema: {
    definition: ConfigurationSchemaDefinition
    options: { refuses?: ConfigurationSchemaRequirement[] }
  },
  snapshot: Record<string, unknown>,
): RequirementProblem[] {
  const { definition } = schema
  return (schema.options.refuses ?? [])
    .filter(({ when }) => whenHolds(definition, when, snapshot))
    .flatMap(({ id, slots, message }) =>
      slots
        .filter(path => holdsAValue(valueAt(snapshot, path.split('.'))))
        .map(slot => ({ id, slot, message: filledMessage(message, snapshot) })),
    )
}

/** `snapshot` without the value at the dotted `path`. */
export function withoutPath(
  snapshot: Record<string, unknown>,
  path: readonly string[],
): Record<string, unknown> {
  const [head = '', ...rest] = path
  const value = snapshot[head]
  const { [head]: _dropped, ...others } = snapshot
  return rest.length === 0
    ? others
    : isPlainObject(value)
      ? { ...snapshot, [head]: withoutPath(value, rest) }
      : snapshot
}
