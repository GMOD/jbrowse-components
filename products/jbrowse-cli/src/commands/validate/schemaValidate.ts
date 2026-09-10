// Validates a config against the generated JSON Schema and turns each failure
// into a Problem an author can act on: the path in the config's own spelling,
// the accepted keys with a did-you-mean, and for a union the errors of the
// branch the value was written for rather than of every branch.

import { Ajv2020 } from 'ajv/dist/2020.js'

import { configJsonSchema } from './configSchema.generated.ts'
import { didYouMean } from './suggest.ts'

import type { Problem } from './types.ts'
import type { ErrorObject, ValidateFunction } from 'ajv/dist/2020.js'

type Schema = Record<string, unknown>

const root = configJsonSchema as Schema
const defs = root.$defs as Record<string, Schema>
const schemaId = root.$id as string

// Every object inside the schema, keyed by identity, to its JSON pointer: ajv
// reports `parentSchema` as the object and its `schemaPath` relative to the
// nearest $ref target, and a union branch is re-validated by absolute pointer.
const pointers = new Map<object, string>()
function index(node: unknown, pointer: string) {
  if (typeof node !== 'object' || node === null) {
    return
  }
  pointers.set(node, pointer)
  for (const [key, value] of Object.entries(node)) {
    index(
      value,
      `${pointer}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`,
    )
  }
}
index(root, '')

let ajv: Ajv2020 | undefined
function validatorFor(pointer: string): ValidateFunction {
  ajv ??= new Ajv2020({ allErrors: true, strict: false, verbose: true })
  if (pointer === '') {
    return ajv.getSchema(schemaId) ?? ajv.compile(root)
  }
  const fn = ajv.getSchema(`${schemaId}#${pointer}`)
  if (!fn) {
    throw new Error(`no schema at ${pointer}`)
  }
  return fn
}

function refName(schema: Schema | undefined) {
  return typeof schema?.$ref === 'string'
    ? schema.$ref.replace('#/$defs/', '')
    : undefined
}

function resolve(schema: Schema): Schema {
  const name = refName(schema)
  return name ? (defs[name] ?? schema) : schema
}

// The keys an object schema accepts: its own properties plus those of every
// slot table it intersects through allOf.
function acceptedKeys(schema: Schema): string[] {
  const own = Object.keys((schema.properties as Schema | undefined) ?? {})
  const composed = ((schema.allOf as Schema[] | undefined) ?? []).flatMap(
    branch => Object.keys(resolve(branch).properties as Schema),
  )
  return [...new Set([...own, ...composed])]
}

function describe(schema: Schema): string {
  const name = refName(schema)
  if (name === 'FileLocation') {
    return 'a file location ({ "uri": ... } or { "localPath": ... })'
  }
  if (name === 'JexlString') {
    return 'a "jexl:" expression'
  }
  if (name) {
    return `a ${name}`
  }
  if (Array.isArray(schema.enum)) {
    return `one of ${schema.enum.map(v => JSON.stringify(v)).join(', ')}`
  }
  if ('const' in schema) {
    return JSON.stringify(schema.const)
  }
  if (Array.isArray(schema.anyOf)) {
    return (schema.anyOf as Schema[]).map(describe).join(' or ')
  }
  switch (schema.type) {
    case 'array':
      return schema.items
        ? `an array of ${describe(schema.items as Schema)}`
        : 'an array'
    case 'object':
      return 'an object'
    case 'string':
      return 'a string'
    case 'number':
    case 'integer':
      return 'a number'
    case 'boolean':
      return 'a boolean'
    default:
      return 'a value'
  }
}

function pathOf(instancePath: string) {
  return instancePath
    .split('/')
    .slice(1)
    .map(seg => seg.replaceAll('~1', '/').replaceAll('~0', '~'))
    .map(seg => (/^\d+$/.test(seg) ? `[${seg}]` : `.${seg}`))
    .join('')
    .replace(/^\./, '')
}

function join(where: string, key: string) {
  return where ? `${where}.${key}` : key
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function typeOf(data: unknown) {
  return isRecord(data) && typeof data.type === 'string' ? data.type : undefined
}

function admitsType(schema: Schema, type: string) {
  const prop = (schema.properties as Schema | undefined)?.type as
    | Schema
    | undefined
  return prop
    ? prop.const === type ||
        (Array.isArray(prop.enum) && prop.enum.includes(type))
    : false
}

const viewNames = new Set(
  (((defs.View!.properties as Schema).type as Schema).anyOf as Schema[])[0]!
    .enum as string[],
)

// What the message says an unknown key is, by the kind of object it sits on.
// A session node is instantiated by a state model rather than a config schema,
// so a slot name written there is dropped just like a misspelling — and the
// advice differs, because the key is real and there are two right places for
// it.
function unknownKeyMessage(
  key: string,
  schema: Schema,
  accepted: string[],
): string {
  const title = typeof schema.title === 'string' ? schema.title : ''
  const guess = didYouMean(key, accepted)
  if (key === 'sequenceAdapter' && !title.endsWith('Snapshot')) {
    return 'JBrowse takes the sequence from the assembly the track is displayed against, and this adapter declares no `sequenceAdapter` slot, so the one written here is never read — delete it'
  }
  if (title.endsWith('Snapshot')) {
    const slots = Object.keys(
      defs[`${title.replace(/Snapshot$/, '')}Slots`]?.properties as Schema,
    )
    return slots.includes(key)
      ? `"${key}" is a config slot, not a display property, so a session snapshot drops it and the setting silently does nothing — put it on the track's "displays" entry under "tracks", or in a "trackConfigDeltas" entry, instead`
      : `unknown display property "${key}"${didYouMean(key, [...accepted, ...slots])} — a session snapshot drops keys the display does not declare, so this setting silently does nothing`
  }
  if (viewNames.has(title)) {
    const elsewhere = [...viewNames].filter(
      name =>
        name !== title &&
        Object.keys(defs[name]!.properties as Schema).includes(key),
    )
    return elsewhere.length
      ? `"${key}" is a setting of ${elsewhere.join(', ')}, not of ${title}${guess} — a session snapshot drops keys the view does not declare, so this setting silently does nothing`
      : `unknown view key "${key}"${guess} — a session snapshot drops keys the view does not declare, so this setting silently does nothing`
  }
  if (title === 'Session') {
    return `unknown session key "${key}"${guess} — a session snapshot drops keys it does not declare, so this setting silently does nothing`
  }
  if (title.endsWith('DisplayDefaults')) {
    return `no display of this track declares "${key}"${guess}`
  }
  if (title.endsWith('TrackEntry')) {
    return `"${key}" is neither a config slot nor a property of ${title.replace(/TrackEntry$/, '')}${guess} — the entry's keys are folded onto that display, and one it does not declare silently does nothing`
  }
  return `unknown slot "${key}"${guess} — JBrowse ignores keys it does not declare, so this setting silently does nothing`
}

function isJexl(value: unknown) {
  return typeof value === 'string' && value.startsWith('jexl:')
}

function branchesOf(error: ErrorObject) {
  return (error.parentSchema as Schema).anyOf as Schema[]
}

// Which branch of a union the value was written for: the one whose `type` it
// names, else the one it comes closest to satisfying.
function pickBranch(
  error: ErrorObject,
  data: unknown,
  errors: ErrorObject[],
): number {
  const branches = branchesOf(error)
  const type = typeOf(data)
  if (type !== undefined) {
    const byType = branches.findIndex(b => admitsType(resolve(b), type))
    if (byType >= 0) {
      return byType
    }
  }
  if (isRecord(data)) {
    const tagged = branches.findIndex(
      b =>
        'locationType' in data &&
        admitsLocation(resolve(b), data.locationType as string),
    )
    if (tagged >= 0) {
      return tagged
    }
    const untagged = branches.findIndex(b => 'not' in resolve(b))
    if (untagged >= 0 && !('locationType' in data)) {
      return untagged
    }
  }
  const counts = branches.map((_, i) => {
    const prefix = `${error.schemaPath}/${i}/`
    return errors.filter(
      e =>
        e.schemaPath.startsWith(prefix) &&
        e.instancePath.startsWith(error.instancePath),
    ).length
  })
  const structural = branches.map((b, i) =>
    counts[i] === 0 ? Infinity : counts[i]!,
  )
  return structural.indexOf(Math.min(...structural))
}

function admitsLocation(schema: Schema, locationType: string) {
  const prop = (schema.properties as Schema | undefined)?.locationType as
    | Schema
    | undefined
  return prop?.const === locationType
}

function requiredOnly(branches: Schema[]) {
  return branches.every(
    b => Object.keys(b).length === 1 && Array.isArray(b.required),
  )
}

// Converts ajv's errors at one validation into Problems, recursing into the
// chosen branch of each failed union so the author sees one diagnosis rather
// than one per alternative.
function explain(
  data: unknown,
  errors: ErrorObject[],
  problems: Problem[],
  depth: number,
) {
  const covered = new Set<string>()
  const emit = (where: string, message: string) => {
    const key = `${where} ${message}`
    if (!covered.has(key)) {
      covered.add(key)
      problems.push({ level: 'error', where, message })
    }
  }
  // A union failure explains everything beneath it; the branch is re-validated
  // on its own so the sub-errors reported for the other branches drop out.
  const unions = errors.filter(e => e.keyword === 'anyOf')
  const shadowed = (e: ErrorObject) =>
    unions.some(
      u =>
        u !== e &&
        (e.instancePath === u.instancePath ||
          e.instancePath.startsWith(`${u.instancePath}/`)),
    )
  for (const error of errors) {
    if (shadowed(error) || error.keyword === 'if') {
      continue
    }
    const where = pathOf(error.instancePath)
    const parent = error.parentSchema as Schema
    switch (error.keyword) {
      case 'additionalProperties':
      case 'unevaluatedProperties': {
        const key = String(
          error.params.additionalProperty ?? error.params.unevaluatedProperty,
        )
        emit(
          join(where, key),
          unknownKeyMessage(key, parent, acceptedKeys(parent)),
        )
        break
      }
      case 'required':
        emit(where, `missing "${String(error.params.missingProperty)}"`)
        break
      case 'anyOf': {
        const branches = branchesOf(error)
        const value = error.data
        if (requiredOnly(branches)) {
          emit(
            where,
            `needs one of ${branches.map(b => `"${(b.required as string[])[0]}"`).join(', ')}`,
          )
          break
        }
        const jexlBranch = branches.findIndex(b => refName(b) === 'JexlString')
        if (jexlBranch >= 0 && !isJexl(value)) {
          const others = branches.filter((_, i) => i !== jexlBranch)
          emit(
            where,
            `expected ${others.map(describe).join(' or ')} or a "jexl:" expression, got ${JSON.stringify(value)}`,
          )
          break
        }
        if (depth > 8) {
          emit(where, `does not match any accepted form`)
          break
        }
        const pointer = pointers.get(parent)
        const branch = pickBranch(error, value, errors)
        if (pointer === undefined || branch < 0) {
          emit(where, 'does not match any accepted form')
          break
        }
        const fn = validatorFor(`${pointer}/anyOf/${branch}`)
        if (!fn(value) && fn.errors?.length) {
          const nested: Problem[] = []
          explain(value, fn.errors, nested, depth + 1)
          for (const p of nested) {
            emit(join(where, p.where).replaceAll('.[', '['), p.message)
          }
        } else {
          emit(where, 'does not match any accepted form')
        }
        break
      }
      case 'type':
      case 'enum':
      case 'const':
      case 'pattern':
        emit(
          where,
          `expected ${describe(parent)}, got ${JSON.stringify(error.data)}`,
        )
        break
      case 'not':
        emit(where, `must not ${describe(parent.not as Schema)}`)
        break
      default:
        emit(where, error.message ?? error.keyword)
    }
  }
}

export function schemaProblems(config: unknown): Problem[] {
  const validate = validatorFor('')
  if (validate(config)) {
    return []
  }
  const problems: Problem[] = []
  explain(config, validate.errors ?? [], problems, 0)
  return problems.map(p => ({
    ...p,
    where: p.where.replace(/^\./, ''),
  }))
}

export { schemaId as configSchemaUrl }
