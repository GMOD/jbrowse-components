// Walks the live ConfigurationSchema objects and state models into one JSON
// Schema (draft 2020-12) for config.json and the session spec. Runs inside the
// introspection bundle generateConfigManifest.ts builds, which is why every
// handle it reads arrives through `deps` rather than an import: `scripts/`
// resolves neither @jbrowse/core nor the plugins.
//
// Shape: every registered type gets `$defs/<Name>Slots` (its slot table, no
// identity, open) and `$defs/<Name>` (the closed object: `type`, identifier,
// the slots by reference). The split is what lets a track's `displayDefaults`
// and a session's inline track entry intersect several displays' slot tables
// without restating them.

/* eslint-disable unicorn/no-thenable -- `if`/`then` are JSON Schema keywords */

export type JsonSchema = Record<string, unknown>

export interface MstType {
  name: string
  flags: number
  properties?: Record<string, MstType>
  value?: unknown
  getSubTypes(): MstType | MstType[] | null | string | undefined
  getChildType?(): MstType
}

export interface SlotDefinition {
  type: string
  description?: string
  defaultValue?: unknown
  model?: MstType
  contextVariable?: string[]
}

export interface SchemaMetadata {
  definition: Record<string, SlotDefinition | string | number | MstType>
  options: {
    explicitlyTyped?: boolean
    explicitIdentifier?: string
    shorthand?: string
    closed?: boolean
    shorthandWith?: Record<string, unknown>
    preProcessSnapshot?: (snap: unknown) => unknown
    requires?: {
      id: string
      when: Record<string, string[]>
      slots: string[]
      message: string
    }[]
  }
}

// What a schema's own preProcessSnapshot does to one slot, asked by probing it:
// a bare string becoming a list of one (a step's `as`), numbers carried as
// strings (a ramp's `domain: [0, 100]`), and a bare string becoming a file
// location (`htsgetBase: "https://…"`). The JSON schema admits the file spelling
// and the manifest records the lift, so the validator lifts a file the way the
// app does before its rules read it.
//
// A `shorthandKeys` entry cannot express the `uri` lift, which widens a slot the
// schema already declares instead of adding one. So nothing saw it, and
// `jbrowse validate` reported HtsgetBamAdapter's own documented example as an
// error.
export function slotLifts(meta: SchemaMetadata, slot: string) {
  const lifted = (input: unknown) => {
    try {
      const out = meta.options.preProcessSnapshot?.({ [slot]: input }) as
        | Record<string, unknown>
        | undefined
      return out?.[slot]
    } catch {
      return undefined
    }
  }
  const fromString = lifted('probe')
  const fromNumbers = lifted([1])
  return {
    string:
      Array.isArray(fromString) &&
      fromString.length === 1 &&
      fromString[0] === 'probe',
    numbers: Array.isArray(fromNumbers) && fromNumbers[0] === '1',
    uri:
      typeof fromString === 'object' &&
      fromString !== null &&
      (fromString as Record<string, unknown>).uri === 'probe',
  }
}

export interface ElementEntry {
  name: string
  configSchema?: MstType
  stateModel?: MstType
  aliases?: string[]
  viewType?: string
  // the view whose display types this one inherits (a CircularView draws a
  // LinearGenomeView display as a ring)
  extendedName?: string
  displayTypes?: { name: string }[]
  launchKeys?: {
    keys: Record<string, { kind: string }>
    passThrough: readonly string[]
  }
}

export interface Deps {
  schemaId: string
  version: string
  elements: {
    adapters: ElementEntry[]
    tracks: ElementEntry[]
    displays: ElementEntry[]
    textSearchAdapters: ElementEntry[]
    connections: ElementEntry[]
    internetAccounts: ElementEntry[]
    views: ElementEntry[]
  }
  metadataOf: (type: MstType) => SchemaMetadata | undefined
  /** The name and members of a `ConfigurationSchemaUnion`, keyed by `type`. */
  unionOf: (
    type: MstType,
  ) => { name: string; members: Record<string, MstType> } | undefined
  /** The bare value a schema's `shorthand` lifts, as the config reader decides it. */
  shorthandFormOf: (meta: SchemaMetadata) => 'string' | 'number' | undefined
  /** The CSS named colors, as the painters' table spells them. */
  cssColorNames: readonly string[]
  isType: (thing: unknown) => boolean
  isArrayType: (type: MstType) => boolean
  isMapType: (type: MstType) => boolean
  isModelType: (type: MstType) => boolean
  isLiteralType: (type: MstType) => boolean
  isFrozenType: (type: MstType) => boolean
  isIdentifierType: (type: MstType) => boolean
  isReferenceType: (type: MstType) => boolean
  fileLocation: MstType
  assemblySchema: MstType
  rootConfigSchema: MstType
  configModel: MstType
  sessionModel: MstType
  migratedDisplayKeys: Record<string, string[]>
  legacyKeysOf: (group: string, name: string) => string[]
  legacyValuesOf: (group: string, name: string) => Record<string, unknown[]>
  shorthandKeysOf: (group: string, name: string) => string[]
}

// The forms `isCssColor` parses, as one anchored regex: JSON Schema patterns
// carry no case flag, so each named color is spelled letter by letter.
function cssColorPattern(names: readonly string[]) {
  const anyCase = (word: string) =>
    word.replaceAll(/[a-z]/g, c => `[${c}${c.toUpperCase()}]`)
  const forms = [
    '#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})',
    String.raw`(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^()]*\)`,
    String.raw`\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}`,
    ...[...names, 'transparent'].map(anyCase),
  ]
  return String.raw`^\s*(?:${forms.join('|')})\s*$`
}

// The annotation on an `if`/`then` that states a `requires` entry: its id and
// the one slot path the branch requires, which the CLI validator reports at.
const REQUIREMENT = 'x-requirement'

// The annotation on a `closed` schema's object: JBrowse refuses a key it does
// not declare where every other schema drops one, and the validator says which.
const CLOSED = 'x-closed'

const COMMENT_KEYS = { '^_+comment': {} }
const FROZEN_NOTE =
  'Any JSON value: the slot is `frozen`, so its shape is not checked here.'

const ref = (name: string): JsonSchema => ({ $ref: `#/$defs/${name}` })

function closed(
  properties: Record<string, JsonSchema>,
  required: string[] = [],
  extra: JsonSchema = {},
): JsonSchema {
  return {
    type: 'object',
    ...extra,
    properties,
    ...(required.length ? { required } : {}),
    patternProperties: COMMENT_KEYS,
    additionalProperties: false,
  }
}

// The same, over an intersection of slot tables named by reference.
function composed(
  refs: string[],
  properties: Record<string, JsonSchema>,
  required: string[] = [],
  extra: JsonSchema = {},
): JsonSchema {
  return {
    type: 'object',
    ...extra,
    allOf: refs.map(ref),
    properties,
    ...(required.length ? { required } : {}),
    patternProperties: COMMENT_KEYS,
    unevaluatedProperties: false,
  }
}

function typeMatch(name: string, aliases: string[] | undefined): JsonSchema {
  return aliases?.length ? { enum: [name, ...aliases] } : { const: name }
}

// `if type is X then X`, one arm per registered type. A `type` no arm names
// passes with its keys unchecked: a plugin registers types this schema never
// saw, and JBrowse itself is loud about a type nothing registers.
function dispatch(
  entries: ElementEntry[],
  defName: (entry: ElementEntry) => string,
): JsonSchema[] {
  return entries.map(entry => ({
    if: {
      type: 'object',
      properties: { type: typeMatch(entry.name, entry.aliases) },
      required: ['type'],
    },
    then: ref(defName(entry)),
  }))
}

function typeHint(names: string[]): JsonSchema {
  return {
    type: 'string',
    description:
      'Which registered type this is. A name the core plugins do not register (one a plugin adds) passes with its keys unchecked.',
    anyOf: [{ enum: names }, { type: 'string' }],
  }
}

export function buildConfigJsonSchema(deps: Deps): JsonSchema {
  const defs: Record<string, JsonSchema> = {}
  const configDefNames = new Map<MstType, string>()
  const stateDefNames = new Map<MstType, string>()
  // A union over every registered type of one group — the `adapter` slot, a
  // track's `displays`, a session's `views` — is that group's dispatching def.
  const groupUnions = new Map<string, string>()
  function registerGroupUnion(defName: string, members: string[]) {
    groupUnions.set([...members].sort().join('|'), defName)
  }
  function groupUnionOf(branches: JsonSchema[]) {
    const names = branches.map(b =>
      typeof b.$ref === 'string' ? b.$ref.replace('#/$defs/', '') : '',
    )
    return names.every(Boolean)
      ? groupUnions.get([...names].sort().join('|'))
      : undefined
  }

  function unwrap(type: MstType) {
    let cur = type
    let jexl = false
    let color = false
    for (let i = 0; i < 16; i++) {
      if (cur.name === 'JexlString') {
        jexl = true
      }
      if (cur.name === 'CssColor') {
        color = true
      }
      const sub = cur.getSubTypes()
      if (!sub || typeof sub !== 'object' || Array.isArray(sub)) {
        break
      }
      cur = sub
    }
    return { type: cur, jexl, color }
  }

  function collapseAnyOf(branches: JsonSchema[]): JsonSchema {
    const flat = branches.flatMap(b =>
      Array.isArray(b.anyOf) ? (b.anyOf as JsonSchema[]) : [b],
    )
    const seen = new Set<string>()
    const unique = flat.filter(b => {
      const key = JSON.stringify(b)
      return seen.has(key) ? false : (seen.add(key), true)
    })
    if (unique.length === 1) {
      return unique[0]!
    }
    if (unique.every(b => 'const' in b && Object.keys(b).length === 1)) {
      return { enum: unique.map(b => b.const) }
    }
    return { anyOf: unique }
  }

  // A plain MST type as JSON Schema. A registered config schema or state model
  // comes back as a $ref; anything else is inlined, to a depth.
  function mstSchema(raw: MstType, depth: number): JsonSchema {
    if (raw === deps.fileLocation) {
      return ref('FileLocation')
    }
    const declared = deps.unionOf(raw)
    if (declared) {
      return declaredUnion(declared.name, declared.members, depth)
    }
    const configName = configDefNames.get(raw)
    if (configName) {
      return ref(configName)
    }
    const meta = deps.metadataOf(raw)
    if (meta) {
      return configObject(raw, meta, depth)
    }
    const { type, jexl, color } = unwrap(raw)
    if (jexl) {
      return ref('JexlString')
    }
    if (color) {
      return ref('CssColor')
    }
    if (type !== raw) {
      return mstSchema(type, depth)
    }
    const stateName = stateDefNames.get(type)
    if (stateName) {
      return ref(stateName)
    }
    const sub = type.getSubTypes()
    if (Array.isArray(sub)) {
      const members = sub.filter(m => m.name !== 'undefined')
      const branches = members.map(m => mstSchema(m, depth))
      const group = groupUnionOf(branches)
      return group ? ref(group) : collapseAnyOf(branches)
    }
    if (deps.isArrayType(type)) {
      return { type: 'array', items: mstSchema(type.getChildType!(), depth) }
    }
    if (deps.isMapType(type)) {
      return {
        type: 'object',
        additionalProperties: mstSchema(type.getChildType!(), depth),
      }
    }
    if (deps.isModelType(type)) {
      if (depth > 4) {
        return { type: 'object' }
      }
      return closed(
        Object.fromEntries(
          Object.entries(type.properties ?? {}).map(([k, v]) => [
            k,
            mstSchema(v, depth + 1),
          ]),
        ),
      )
    }
    if (deps.isLiteralType(type)) {
      return { const: type.value }
    }
    if (deps.isFrozenType(type)) {
      return {}
    }
    if (deps.isIdentifierType(type) || deps.isReferenceType(type)) {
      return { type: 'string' }
    }
    switch (type.name) {
      case 'string':
        return { type: 'string' }
      case 'number':
      case 'Date':
        return { type: 'number' }
      case 'integer':
        return { type: 'integer' }
      case 'boolean':
        return { type: 'boolean' }
      case 'null':
        return { type: 'null' }
      default:
        return {}
    }
  }

  // The value half of the common callback slot types, shared as one def each:
  // a callback slot is `<value> | jexl:`, and an inline anyOf per slot is what
  // ajv spends its compile time on.
  const SHARED_SLOT_DEFS: Record<string, [string, JsonSchema]> = {
    string: ['StringOrJexl', { type: 'string' }],
    maybeString: ['StringOrJexl', { type: 'string' }],
    text: ['StringOrJexl', { type: 'string' }],
    color: ['CssColorOrJexl', ref('CssColor')],
    maybeColor: ['CssColorOrJexl', ref('CssColor')],
    number: ['NumberOrJexl', { type: 'number' }],
    maybeNumber: ['NumberOrJexl', { type: 'number' }],
    integer: ['IntegerOrJexl', { type: 'integer' }],
    boolean: ['BooleanOrJexl', { type: 'boolean' }],
    maybeBoolean: ['BooleanOrJexl', { type: 'boolean' }],
    fileLocation: ['FileLocationOrJexl', ref('FileLocation')],
    maybeFileLocation: ['FileLocationOrJexl', ref('FileLocation')],
    stringArray: [
      'StringArrayOrJexl',
      { type: 'array', items: { type: 'string' } },
    ],
    colorArray: [
      'CssColorArrayOrJexl',
      { type: 'array', items: ref('CssColor') },
    ],
  }
  for (const [name, value] of Object.values(SHARED_SLOT_DEFS)) {
    defs[name] = { anyOf: [value, ref('JexlString')] }
  }

  function builtinSlot(type: string): JsonSchema {
    switch (type) {
      case 'stringArray':
        return { type: 'array', items: { type: 'string' } }
      case 'colorArray':
        return { type: 'array', items: ref('CssColor') }
      case 'stringArrayMap':
        return {
          type: 'object',
          additionalProperties: { type: 'array', items: { type: 'string' } },
        }
      case 'numberMap':
        return { type: 'object', additionalProperties: { type: 'number' } }
      case 'stringMap':
        return { type: 'object', additionalProperties: { type: 'string' } }
      case 'boolean':
      case 'maybeBoolean':
        return { type: 'boolean' }
      case 'color':
      case 'maybeColor':
        return ref('CssColor')
      case 'string':
      case 'maybeString':
      case 'text':
        return ref('PlainString')
      case 'featureField':
        return ref('FeatureField')
      case 'integer':
        return { type: 'integer' }
      case 'number':
      case 'maybeNumber':
        return { type: 'number' }
      case 'fileLocation':
      case 'maybeFileLocation':
        return ref('FileLocation')
      default:
        throw new Error(`no JSON Schema mapping for slot type "${type}"`)
    }
  }

  function slotSchema(
    def: SlotDefinition,
    depth: number,
    legacyValues?: unknown[],
    lifts = { string: false, numbers: false, uri: false },
  ): JsonSchema {
    const frozen = def.type === 'frozen' || def.type === 'maybeFrozen'
    const description = [def.description?.trim(), frozen ? FROZEN_NOTE : '']
      .filter((s): s is string => Boolean(s))
      .map(s => (/[.!?]$/.test(s) ? s : `${s}.`))
      .join(' ')
    const legacy = legacyValues?.length
      ? [
          {
            enum: legacyValues,
            deprecated: true,
            description:
              'Legacy spellings a migration rewrites when the config loads.',
          },
        ]
      : []
    const lifted = lifts.string || lifts.numbers || lifts.uri
    const shared = lifted ? undefined : SHARED_SLOT_DEFS[def.type]
    const value = def.model
      ? def.type === 'stringEnumArray'
        ? { type: 'array', items: mstSchema(def.model, depth) }
        : mstSchema(def.model, depth)
      : frozen
        ? {}
        : lifts.uri
          ? { anyOf: [builtinSlot(def.type), { type: 'string' }] }
          : lifted
            ? {
                anyOf: [
                  {
                    type: 'array',
                    items: lifts.numbers
                      ? { anyOf: [{ type: 'string' }, { type: 'number' }] }
                      : { type: 'string' },
                  },
                  ...(lifts.string ? [{ type: 'string' }] : []),
                ],
              }
            : builtinSlot(def.type)
    const form = def.contextVariable?.length
      ? frozen
        ? {}
        : shared && !def.model && !legacyValues?.length
          ? ref(shared[0])
          : { anyOf: [value, ...legacy, ref('JexlString')] }
      : frozen
        ? { not: ref('JexlString') }
        : legacy.length
          ? { anyOf: [value, ...legacy] }
          : value
    const withDefault =
      def.defaultValue === undefined ||
      typeof def.defaultValue === 'function' ||
      (typeof def.defaultValue === 'object' &&
        def.defaultValue !== null &&
        Object.keys(def.defaultValue).length === 0)
        ? {}
        : { default: def.defaultValue }
    return { ...(description ? { description } : {}), ...form, ...withDefault }
  }

  // A lift only widens the slot type it is a lift of. A bare string means a list
  // of one in a `stringArray` and a `{ uri }` in a file location, so reading
  // either onto the other slot type admits a shape the schema refuses.
  function liftsFor(meta: SchemaMetadata, slot: string, type: string) {
    const lifts = slotLifts(meta, slot)
    if (type === 'stringArray') {
      return { ...lifts, uri: false }
    }
    if (type === 'fileLocation' || type === 'maybeFileLocation') {
      return { ...lifts, string: false, numbers: false }
    }
    return undefined
  }

  function isSlotDefinition(entry: unknown): entry is SlotDefinition {
    return (
      typeof entry === 'object' &&
      entry !== null &&
      !deps.isType(entry) &&
      typeof (entry as SlotDefinition).type === 'string'
    )
  }

  function slotTable(
    meta: SchemaMetadata,
    depth: number,
    legacyValues: Record<string, unknown[]> = {},
  ) {
    const properties: Record<string, JsonSchema> = {}
    for (const [slot, entry] of Object.entries(meta.definition)) {
      if (isSlotDefinition(entry)) {
        properties[slot] = slotSchema(
          entry,
          depth + 1,
          legacyValues[slot],
          liftsFor(meta, slot, entry.type),
        )
      } else if (deps.isType(entry)) {
        properties[slot] = mstSchema(entry as MstType, depth + 1)
      }
    }
    return properties
  }

  function identityOf(meta: SchemaMetadata, name: string) {
    const properties: Record<string, JsonSchema> = {}
    if (meta.options.explicitlyTyped) {
      properties.type = { const: name }
    }
    const idName = meta.options.explicitIdentifier
    if (idName) {
      properties[idName] = { type: 'string' }
    }
    return properties
  }

  // What a sub-schema's own preProcessSnapshot lifts, asked by probing it: a
  // bare string (a mark encoding's `"y": "score"`) and a `uri` beside no
  // `adapter` (an assembly's `refNameAliases`). The probe has to come back out
  // of the lift for the form to count, since a normalizer built for objects
  // returns an object for a string too.
  function liftedForms(meta: SchemaMetadata) {
    const lift = meta.options.preProcessSnapshot
    const lifts = (input: unknown) => {
      try {
        const out = lift?.(input)
        return (
          typeof out === 'object' &&
          out !== null &&
          JSON.stringify(out).includes('probe') &&
          JSON.stringify(out) !== JSON.stringify(input)
        )
      } catch {
        return false
      }
    }
    return {
      bare: deps.shorthandFormOf(meta),
      uri: lifts({ uri: 'probe' }),
    }
  }

  // What a schema declares it cannot mean (`requires`), as `if`/`then` carrying
  // the requirement's id and message: `errorMessage` is what an editor's JSON
  // language service shows, and the CLI validator reports the branch as that
  // one problem. A display reads the same entries through
  // `requirementProblems`. A `when` value that is the slot's own default fires
  // for an absent slot too, in both.
  function whenSchema(meta: SchemaMetadata, when: Record<string, string[]>) {
    const properties: Record<string, JsonSchema> = {}
    const required: string[] = []
    for (const [slot, values] of Object.entries(when)) {
      properties[slot] = { enum: values }
      const entry = meta.definition[slot]
      if (
        !isSlotDefinition(entry) ||
        !values.includes(entry.defaultValue as string)
      ) {
        required.push(slot)
      }
    }
    return { properties, ...(required.length ? { required } : {}) }
  }

  // A slot names a value when it holds a non-empty string, or the object its
  // string shorthand lifts into with that target slot non-empty.
  function namesAValue(sub: SchemaMetadata | undefined): JsonSchema {
    const target =
      sub && liftedForms(sub).bare === 'string' ? stringTarget(sub) : undefined
    return target
      ? {
          anyOf: [
            { type: 'string', minLength: 1 },
            {
              type: 'object',
              required: [target],
              properties: { [target]: { type: 'string', minLength: 1 } },
            },
          ],
        }
      : { type: 'string', minLength: 1 }
  }

  function pathRequirement(meta: SchemaMetadata, path: string[]): JsonSchema {
    const [head, ...rest] = path as [string, ...string[]]
    const entry = meta.definition[head]
    const sub = deps.isType(entry)
      ? deps.metadataOf(entry as MstType)
      : undefined
    const value = rest.length
      ? sub
        ? pathRequirement(sub, rest)
        : {}
      : namesAValue(sub)
    return {
      type: 'object',
      required: [head],
      properties: { [head]: value },
    }
  }

  function requirements(meta: SchemaMetadata): JsonSchema {
    const rules = meta.options.requires ?? []
    if (rules.length === 0) {
      return {}
    }
    return {
      allOf: rules.flatMap(rule =>
        rule.slots.map(slot => ({
          [REQUIREMENT]: { id: rule.id, slot },
          if: { type: 'object', ...whenSchema(meta, rule.when) },
          then: pathRequirement(meta, slot.split('.')),
          errorMessage: rule.message,
        })),
      ),
    }
  }

  // A `ConfigurationSchemaUnion`: `type` is one of its keys and dispatches to
  // that member's closed object, the shape `$defs.Display` has. The keys are
  // an enum rather than any string, since no plugin adds a member.
  const declaredUnions = new Map<string, Record<string, MstType>>()
  function declaredUnion(
    name: string,
    members: Record<string, MstType>,
    depth: number,
  ): JsonSchema {
    const seen = declaredUnions.get(name)
    if (seen && seen !== members) {
      throw new Error(`two ConfigurationSchemaUnions are named ${name}`)
    }
    if (!seen) {
      if (name in defs) {
        throw new Error(
          `the ConfigurationSchemaUnion ${name} names a def already taken`,
        )
      }
      declaredUnions.set(name, members)
      const arms = Object.entries(members).map(([key, member]) => {
        const meta = deps.metadataOf(member)
        if (!meta) {
          throw new Error(`${name}'s "${key}" has no registered metadata`)
        }
        return {
          key,
          then: configObject(member, meta, depth, `${name}.${key}`),
        }
      })
      defs[name] = {
        title: name,
        type: 'object',
        properties: { type: { enum: Object.keys(members) } },
        required: ['type'],
        allOf: arms.map(({ key, then }) => ({
          if: {
            type: 'object',
            properties: { type: { const: key } },
            required: ['type'],
          },
          then,
        })),
      }
    }
    return ref(name)
  }

  // An unregistered ConfigurationSchema, i.e. a sub-schema slot. Every track
  // schema builds its own `textSearching` and `formatDetails`, so identical
  // ones share one definition, named after the sub-schema.
  const sharedByContent = new Map<string, string>()
  function configObject(
    type: MstType,
    meta: SchemaMetadata,
    depth: number,
    defName?: string,
  ): JsonSchema {
    const name = type.name.replace(/ConfigurationSchema$/, '')
    const forms = liftedForms(meta)
    const slots = slotTable(meta, depth)
    const properties = {
      ...identityOf(meta, name),
      ...slots,
      ...(forms.uri
        ? { uri: shorthandSchema('uri'), baseUri: shorthandSchema('baseUri') }
        : {}),
    }
    const object = closed(properties, [], {
      ...requirements(meta),
      ...(meta.options.closed ? { [CLOSED]: true } : {}),
    })
    const target = slots[stringTarget(meta)]
    const base = defName ?? name
    // titled as its def is, since a key the object refuses is reported
    // against this branch rather than the union
    const schema = forms.bare
      ? {
          anyOf: [
            {
              ...target,
              type: forms.bare,
              description: `Shorthand for \`{ "${stringTarget(meta)}": ...${companionText(meta)} }\`.`,
            },
            { title: base, ...object },
          ],
        }
      : object
    const content = `${base}:${JSON.stringify(schema)}`
    let shared = sharedByContent.get(content)
    if (!shared) {
      shared = base
      for (let i = 2; shared in defs; i++) {
        shared = `${base}${i}`
      }
      sharedByContent.set(content, shared)
      defs[shared] = { title: shared, ...schema }
    }
    return ref(shared)
  }

  function shorthandSchema(key: string): JsonSchema {
    switch (key) {
      case 'uri':
        return {
          type: 'string',
          description:
            'Shorthand: the data file, from which the location slots (and the index location) are derived.',
        }
      case 'baseUri':
        return {
          type: 'string',
          description: 'Shorthand: a base URL `uri` resolves against.',
        }
      case 'csi':
        return {
          type: 'boolean',
          description:
            'Shorthand: the index beside `uri` is a `.csi` rather than a `.tbi`/`.bai`.',
        }
      default:
        return {
          description: "Shorthand the adapter's snapshot normalizer expands.",
        }
    }
  }

  // The slot a bare value lifts into, as the schema declares it.
  function companionText(meta: SchemaMetadata) {
    return Object.entries(meta.options.shorthandWith ?? {})
      .map(([slot, value]) => `, "${slot}": ${JSON.stringify(value)}`)
      .join('')
  }

  function stringTarget(meta: SchemaMetadata) {
    return meta.options.shorthand ?? 'value'
  }

  const LEGACY: JsonSchema = {
    deprecated: true,
    description:
      'Legacy key: a migration rewrites it into current slots when the config loads.',
  }

  function registerConfigDefs(
    group: string,
    entries: ElementEntry[],
    unionName: string,
  ) {
    for (const entry of entries) {
      if (entry.configSchema && deps.metadataOf(entry.configSchema)) {
        configDefNames.set(entry.configSchema, entry.name)
      }
    }
    registerGroupUnion(
      unionName,
      entries.filter(e => configDefNames.has(e.configSchema!)).map(e => e.name),
    )
    for (const entry of entries) {
      const meta = entry.configSchema && deps.metadataOf(entry.configSchema)
      if (!meta) {
        continue
      }
      const slots = slotTable(meta, 0, deps.legacyValuesOf(group, entry.name))
      for (const key of deps.shorthandKeysOf(group, entry.name)) {
        slots[key] ??= shorthandSchema(key)
      }
      for (const key of deps.legacyKeysOf(group, entry.name)) {
        slots[key] ??= LEGACY
      }
      defs[`${entry.name}Slots`] = { type: 'object', properties: slots }
      const identity = identityOf(meta, entry.name)
      if (entry.aliases?.length) {
        identity.type = { enum: [entry.name, ...entry.aliases] }
      }
      defs[entry.name] = {
        title: entry.name,
        ...composed([`${entry.name}Slots`], identity, ['type']),
      }
    }
  }

  function union(
    entries: ElementEntry[],
    description: string,
    extra: JsonSchema = {},
  ): JsonSchema {
    const known = entries.filter(e => defs[e.name])
    return {
      type: 'object',
      description,
      properties: { type: typeHint(known.map(e => e.name)) },
      required: ['type'],
      allOf: dispatch(known, e => e.name),
      ...extra,
    }
  }

  // ----------------------------------------------------------------- config

  defs.JexlString = {
    type: 'string',
    pattern: '^jexl:',
    description:
      'A jexl callback evaluated when the slot is read, e.g. `jexl:get(feature, "score") > 10 ? "red" : "blue"`. A slot takes one in place of a fixed value where its config docs list callback args.',
  }
  defs.PlainString = {
    type: 'string',
    not: ref('JexlString'),
  }
  defs.FeatureField = {
    type: 'string',
    description:
      'A field the display reads off each feature: a name, a dotted path into a structured field (`INFO.SVTYPE`), or a `jexl:` expression over `feature`, which the display evaluates per feature.',
  }
  defs.CssColor = {
    type: 'string',
    pattern: cssColorPattern(deps.cssColorNames),
    description:
      'A CSS color: a name like "red", "#rgb" / "#rrggbb" / "#rrggbbaa", or "rgb()" / "rgba()" / "hsl()" / "hsla()". A field name is not a color; color by a field through the display\'s color channel.',
  }
  defs.FileLocation = {
    description:
      'Where a file is: written in full with a `locationType`, or as a bare `{ "uri" }` / `{ "localPath" }` that JBrowse tags itself.',
    anyOf: [
      ...(mstSchema(unwrap(deps.fileLocation).type, 0).anyOf as JsonSchema[]),
      closed(
        {
          uri: { type: 'string' },
          baseUri: { type: 'string' },
          localPath: { type: 'string' },
        },
        [],
        { not: { required: ['locationType'] } },
      ),
    ],
  }

  registerConfigDefs('adapter', deps.elements.adapters, 'Adapter')
  registerConfigDefs('display', deps.elements.displays, 'Display')
  // before tracks, whose `textSearching.textSearchAdapter` slot then resolves
  // to the dispatching union rather than an inline anyOf
  registerConfigDefs(
    'text search adapter',
    deps.elements.textSearchAdapters,
    'TextSearchAdapter',
  )
  registerConfigDefs('track', deps.elements.tracks, 'Track')
  registerConfigDefs('connection', deps.elements.connections, 'Connection')
  registerConfigDefs(
    'internet account',
    deps.elements.internetAccounts,
    'InternetAccount',
  )

  defs.UntypedAdapter = {
    title: 'UntypedAdapter',
    description:
      'An adapter named by file alone. Only an assembly sequence takes this form: JBrowse guesses the adapter from the extension.',
    ...closed(
      { uri: shorthandSchema('uri'), baseUri: shorthandSchema('baseUri') },
      ['uri'],
      { not: { required: ['type'] } },
    ),
  }
  defs.Adapter = union(
    deps.elements.adapters,
    "Where a track's data comes from: an adapter for the file format, whose `type` picks the slots the rest of the object may carry.",
    {
      required: [],
      allOf: [
        ...dispatch(deps.elements.adapters, e => e.name),
        {
          if: { type: 'object', not: { required: ['type'] } },
          then: ref('UntypedAdapter'),
        },
      ],
    },
  )
  defs.Display = union(
    deps.elements.displays,
    "How a track is drawn in one view type, with that display's own slots.",
  )
  const trixIndexUri = { type: 'string', pattern: '\\.ix([?#].*)?$' }
  defs.UntypedTextSearchAdapter = {
    title: 'UntypedTextSearchAdapter',
    description:
      "A trix index named by its `.ix` alone: the type follows from the extension, and `assemblyNames` from the track it sits on or the config's one assembly.",
    ...closed(
      {
        uri: trixIndexUri,
        baseUri: shorthandSchema('baseUri'),
        assemblyNames: { type: 'array', items: { type: 'string' } },
      },
      ['uri'],
      { not: { required: ['type'] } },
    ),
  }
  defs.TextSearchAdapter = {
    anyOf: [
      {
        ...trixIndexUri,
        description:
          "A trix index as its `.ix` path or URL, the same as `{ uri }`: the type follows from the extension, and `assemblyNames` from the track it sits on or the config's one assembly.",
      },
      union(
        deps.elements.textSearchAdapters,
        'A name-search index, built by `jbrowse text-index`.',
        {
          required: [],
          allOf: [
            ...dispatch(deps.elements.textSearchAdapters, e => e.name),
            {
              if: { type: 'object', not: { required: ['type'] } },
              then: ref('UntypedTextSearchAdapter'),
            },
          ],
        },
      ),
    ],
  }
  defs.Connection = union(
    deps.elements.connections,
    'A connection to an external track catalog.',
  )
  defs.InternetAccount = union(
    deps.elements.internetAccounts,
    'An internet account that authorizes requests to protected data.',
  )

  for (const track of deps.elements.tracks) {
    const def = defs[track.name]
    if (!def) {
      continue
    }
    const displays = (track.displayTypes ?? [])
      .map(d => d.name)
      .filter(name => defs[`${name}Slots`])
    const properties = def.properties as Record<string, JsonSchema>
    properties.uri = {
      type: 'string',
      description:
        'The data file, from which JBrowse infers the adapter and, when `type` is omitted, the track type. Write this or `adapter`.',
    }
    properties.index = {
      type: 'string',
      description:
        'The index file beside `uri`, when it is not at the conventional name.',
    }
    // One schema per key: the slot of every display declaring it, any of
    // which may take the value, as the loader routes it
    const declared = new Map<string, JsonSchema[]>()
    for (const name of displays) {
      const slots = defs[`${name}Slots`]!.properties as Record<string, unknown>
      for (const key of Object.keys(slots)) {
        declared.set(key, [
          ...(declared.get(key) ?? []),
          ref(`${name}Slots/properties/${key}`),
        ])
      }
    }
    properties.displayDefaults = {
      title: `${track.name}DisplayDefaults`,
      description:
        "Display settings routed to whichever of this track's displays takes each value, so the track need not name a display or write the `displays` array.",
      ...closed(
        Object.fromEntries(
          [...declared].map(([key, slots]) => [
            key,
            slots.length === 1 ? slots[0]! : { anyOf: slots },
          ]),
        ),
      ),
    }
    def.anyOf = [{ required: ['adapter'] }, { required: ['uri'] }]
  }

  const trackUnion = union(
    deps.elements.tracks,
    'A track: one adapter (where the data is) and one or more displays (how it is drawn). The shortest track is `{ "trackId", "uri", "assemblyNames" }`; any key written beside `uri` overrides what JBrowse infers from the file.',
  )
  const baseTrackSlots = defs.FeatureTrackSlots?.properties as
    | Record<string, JsonSchema>
    | undefined
  if (!baseTrackSlots) {
    throw new Error('FeatureTrack is not registered')
  }
  defs.LooseTrack = {
    title: 'LooseTrack',
    description:
      'A track written as a file and nothing else: JBrowse infers the track type and adapter from the extension.',
    ...closed(
      {
        trackId: { type: 'string' },
        uri: { type: 'string' },
        index: { type: 'string' },
        ...Object.fromEntries(
          Object.entries(baseTrackSlots).filter(
            ([k]) => !['adapter', 'displays'].includes(k),
          ),
        ),
        displayDefaults: { type: 'object' },
      },
      ['trackId', 'uri'],
      { not: { required: ['type'] } },
    ),
  }
  defs.Track = {
    ...trackUnion,
    properties: {
      ...(trackUnion.properties as JsonSchema),
      trackId: {
        type: 'string',
        description:
          'Unique id of the track, the name sessions refer to it by.',
      },
    },
    required: ['trackId'],
    allOf: [
      ...(trackUnion.allOf as JsonSchema[]),
      {
        if: { type: 'object', not: { required: ['type'] } },
        then: ref('LooseTrack'),
      },
    ],
  }

  if (!defs.ReferenceSequenceTrackSlots) {
    throw new Error('ReferenceSequenceTrack is not registered')
  }
  defs.AssemblySequence = {
    title: 'AssemblySequence',
    description:
      'The assembly\'s reference sequence track. `type` and `trackId` are derived when omitted, and the adapter may be a bare `{ "uri" }`.',
    ...composed(['ReferenceSequenceTrackSlots'], {
      type: { const: 'ReferenceSequenceTrack' },
      trackId: { type: 'string' },
    }),
  }

  const assemblyMeta = deps.metadataOf(deps.assemblySchema)
  if (!assemblyMeta) {
    throw new Error('the assembly config schema has no registered metadata')
  }
  const assemblySlots = slotTable(assemblyMeta, 0)
  assemblySlots.sequence = ref('AssemblySequence')
  defs.Assembly = {
    title: 'Assembly',
    description:
      'A reference genome: its sequence, and optionally aliases, refName aliases and cytobands.',
    ...closed(
      {
        name: { type: 'string', description: 'Name of the assembly.' },
        ...assemblySlots,
        uri: {
          type: 'string',
          description:
            'Shorthand: the sequence file, in place of a `sequence` track.',
        },
        baseUri: shorthandSchema('baseUri'),
      },
      ['name'],
      { anyOf: [{ required: ['sequence'] }, { required: ['uri'] }] },
    ),
  }

  // ---------------------------------------------------------------- session

  const stateful = [
    ...deps.elements.displays,
    ...deps.elements.tracks,
    ...deps.elements.views,
  ].filter(e => e.stateModel)
  for (const entry of stateful) {
    stateDefNames.set(
      unwrap(entry.stateModel!).type,
      deps.elements.views.includes(entry)
        ? entry.name
        : `${entry.name}Snapshot`,
    )
  }
  registerGroupUnion(
    'DisplaySnapshot',
    deps.elements.displays
      .filter(e => e.stateModel)
      .map(e => `${e.name}Snapshot`),
  )
  registerGroupUnion(
    'View',
    deps.elements.views.filter(e => e.stateModel).map(e => e.name),
  )

  function stateTable(entry: ElementEntry) {
    const { type } = unwrap(entry.stateModel!)
    const out: Record<string, JsonSchema> = {}
    for (const [key, prop] of Object.entries(type.properties ?? {})) {
      out[key] = key === 'type' ? { const: entry.name } : mstSchema(prop, 1)
    }
    return out
  }

  function stateIdentity(
    entry: ElementEntry,
    table: Record<string, JsonSchema>,
  ) {
    const { type: _t, id: _i, configuration: _c, ...state } = table
    return {
      state,
      identity: {
        type: typeMatch(entry.name, entry.aliases),
        ...(table.id ? { id: table.id } : {}),
        ...(table.configuration ? { configuration: table.configuration } : {}),
      },
    }
  }

  for (const entry of deps.elements.displays.filter(e => e.stateModel)) {
    const { state, identity } = stateIdentity(entry, stateTable(entry))
    for (const key of [
      ...(deps.migratedDisplayKeys['*'] ?? []),
      ...(deps.migratedDisplayKeys[entry.name] ?? []),
    ]) {
      state[key] ??= {
        deprecated: true,
        description:
          'Legacy display-instance key: a migration lifts it onto the setting that replaced it.',
      }
    }
    defs[`${entry.name}State`] = { type: 'object', properties: state }
    defs[`${entry.name}Snapshot`] = {
      title: `${entry.name}Snapshot`,
      description: `A ${entry.name} node inside a saved session: the state model's own properties. A config slot does not belong here; it goes on the track's \`displays\` entry.`,
      ...composed([`${entry.name}State`], identity, ['type']),
    }
  }

  for (const entry of deps.elements.tracks.filter(e => e.stateModel)) {
    const { state, identity } = stateIdentity(entry, stateTable(entry))
    defs[`${entry.name}Snapshot`] = {
      title: `${entry.name}Snapshot`,
      description: `A ${entry.name} node inside a saved session view.`,
      ...closed({ ...identity, ...state }, ['type']),
    }
  }

  const snapshotDisplays = deps.elements.displays.filter(
    d => defs[`${d.name}Snapshot`],
  )
  defs.DisplaySnapshot = {
    ...union(snapshotDisplays, 'A display node inside a saved session.'),
    allOf: dispatch(snapshotDisplays, d => `${d.name}Snapshot`),
  }
  const snapshotTracks = deps.elements.tracks.filter(
    t => defs[`${t.name}Snapshot`],
  )
  defs.TrackSnapshot = {
    ...union(
      snapshotTracks,
      'A built track node inside a saved session view: its config by id, and its display nodes.',
    ),
    required: ['type', 'configuration'],
    allOf: dispatch(snapshotTracks, t => `${t.name}Snapshot`),
  }

  // A track entry in a view's `tracks`: the trackId, or an object whose other
  // keys are one display's config slots and state written inline.
  function trackEntryDef(view: ElementEntry) {
    const displays = deps.elements.displays.filter(
      d =>
        (d.viewType === view.name || d.viewType === view.extendedName) &&
        defs[`${d.name}Slots`] &&
        defs[`${d.name}State`],
    )
    const entry = (d: ElementEntry) =>
      composed(
        [`${d.name}Slots`, `${d.name}State`],
        {
          trackId: { type: 'string' },
          type: {
            const: d.name,
            description:
              'The display to open the track with, when the track offers several for this view.',
          },
          trackSnapshot: {
            type: 'object',
            description: 'Keys applied to the track config node.',
          },
          displaySnapshot: {
            type: 'object',
            description: 'Keys applied to the display node explicitly.',
          },
        },
        ['trackId'],
        { title: `${d.name}TrackEntry` },
      )
    const name = `${view.name}TrackEntry`
    defs[name] = {
      title: name,
      description: `A track to open in a ${view.name}: a trackId, or an object whose other keys are the display's config slots and state written inline.`,
      anyOf: [
        { type: 'string', description: 'A trackId.' },
        {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 1,
          description:
            'A one-element tuple naming a trackId (the synteny levels form).',
        },
        ...displays.map(entry),
        ref('TrackSnapshot'),
      ],
    }
    return name
  }

  function launchKeySchema(
    view: ElementEntry,
    key: string,
    kind: string,
  ): JsonSchema {
    if (kind === 'trackEntries' || key === 'tracks') {
      const entry = ref(trackEntryDef(view))
      return {
        type: 'array',
        description:
          'Tracks to open, each by id or as an object of inline display settings.',
        items:
          kind === 'launch'
            ? { anyOf: [entry, { type: 'array', items: entry }] }
            : entry,
      }
    }
    if (kind === 'rows' || key === 'views') {
      return {
        type: 'array',
        description: 'The rows this view composes, each a view of its own.',
        items: ref('View'),
      }
    }
    if (key === 'highlight') {
      return {
        type: 'array',
        items: { anyOf: [{ type: 'string' }, { type: 'object' }] },
      }
    }
    if (key === 'assembly') {
      return {
        description:
          'The assembly to open; a view that lays several out (the circular view) takes a list.',
        anyOf: [
          { type: 'string' },
          { type: 'array', items: { type: 'string' } },
        ],
      }
    }
    if (key === 'loc') {
      return {
        type: 'string',
        description: 'The locus to navigate to, e.g. `chr1:1-1000`.',
      }
    }
    return {
      description: `Launch key, resolved by the ${view.name} launcher on open.`,
    }
  }

  for (const view of deps.elements.views.filter(v => v.stateModel)) {
    const properties = stateTable(view)
    properties.type = typeMatch(view.name, view.aliases)
    const registration = view.launchKeys
    for (const [key, spec] of Object.entries(registration?.keys ?? {})) {
      properties[key] = launchKeySchema(view, key, spec.kind)
    }
    for (const key of registration?.passThrough ?? []) {
      properties[key] ??= {
        deprecated: true,
        description:
          "Legacy spelling the view's own preProcessSnapshot converts.",
      }
    }
    const { type: identity = {}, ...keys } = properties
    defs[`${view.name}Keys`] = { type: 'object', properties: keys }
    defs[view.name] = {
      title: view.name,
      description: `A ${view.name} in a session: its launch keys (resolved on open) and the state model's own properties.`,
      ...composed(
        [`${view.name}Keys`],
        {
          type: identity,
          init: {
            deprecated: true,
            description:
              'Deprecated nesting: write every setting directly on the view object.',
            ...composed([`${view.name}Keys`], {}, [], { title: view.name }),
          },
        },
        ['type'],
      ),
    }
  }

  const views = deps.elements.views.filter(v => defs[v.name])
  defs.View = {
    type: 'object',
    description:
      "A view in a session. Its `type` picks the view, and the rest of the object is that view's launch keys and state. A synteny row written without a `type` is a recipe its parent resolves.",
    properties: { type: typeHint(views.map(v => v.name)) },
    allOf: dispatch(views, v => v.name),
  }

  const SESSION_OVERRIDES: Record<string, JsonSchema> = {
    views: { type: 'array', items: ref('View') },
    widgets: { type: 'object', additionalProperties: { type: 'object' } },
    activeWidgets: { type: 'object', additionalProperties: { type: 'string' } },
    sessionTracks: { type: 'array', items: ref('Track') },
    sessionAssemblies: { type: 'array', items: ref('Assembly') },
    temporaryAssemblies: { type: 'array', items: ref('Assembly') },
    sessionConnections: { type: 'array', items: ref('Connection') },
  }
  const sessionProperties = Object.fromEntries(
    Object.entries(unwrap(deps.sessionModel).type.properties ?? {}).map(
      ([k, v]) => [k, SESSION_OVERRIDES[k] ?? mstSchema(v, 4)],
    ),
  )
  defs.Session = {
    title: 'Session',
    description:
      'A session: the views to open, written as launch arguments (`assembly`, `loc`, `tracks`) rather than as state snapshots.',
    ...closed(sessionProperties),
  }

  const rootMeta = deps.metadataOf(deps.rootConfigSchema)
  if (!rootMeta) {
    throw new Error('the root configuration schema has no registered metadata')
  }
  defs.RootConfiguration = {
    title: 'RootConfiguration',
    description: 'Site-wide settings under the top-level `configuration` key.',
    ...closed(slotTable(rootMeta, 0)),
  }

  const pluginLoc = closed(
    { uri: { type: 'string' }, baseUri: { type: 'string' } },
    ['uri'],
  )
  defs.PluginDefinition = {
    title: 'PluginDefinition',
    description:
      'A plugin to load: `storePlugin` naming a plugin-store entry, or a build url — `url`/`umdUrl`/`esmUrl`, or `umdLoc`/`esmLoc` for a file beside the config. A UMD build also needs `name`, the global its bundle defines.',
    type: 'object',
    properties: {
      storePlugin: {
        type: 'string',
        description:
          "A plugin-store entry's name, resolved against the store at load time so the config is not pinned to a url or a version. The form to use in a config served from a permanent url.",
      },
      name: { type: 'string' },
      url: { type: 'string' },
      umdUrl: { type: 'string' },
      esmUrl: { type: 'string' },
      // not `FileLocation`: PluginLoader reads `.uri` and `.baseUri` and
      // nothing else, so a `localPath` or a blob resolves to the string
      // "undefined" against the config's base
      umdLoc: pluginLoc,
      esmLoc: pluginLoc,
      integrity: {
        type: 'string',
        description:
          'Subresource integrity hash for a UMD build, as the plugin store publishes it.',
      },
    },
    // `name` is required only alongside a UMD url, which is the one loader that
    // looks the plugin up on `globalThis` by name. An ESM build carries its own
    // name and a store ref gets one from the manifest, so requiring it outright
    // rejected two forms JBrowse loads.
    anyOf: [
      { required: ['storePlugin'] },
      { required: ['esmUrl'] },
      { required: ['esmLoc'] },
      { required: ['name', 'url'] },
      { required: ['name', 'umdUrl'] },
      { required: ['name', 'umdLoc'] },
    ],
  }

  const ROOT_OVERRIDES: Record<string, JsonSchema> = {
    configuration: ref('RootConfiguration'),
    plugins: { type: 'array', items: ref('PluginDefinition') },
    assemblies: { type: 'array', items: ref('Assembly') },
    tracks: { type: 'array', items: ref('Track') },
    internetAccounts: { type: 'array', items: ref('InternetAccount') },
    aggregateTextSearchAdapters: {
      type: 'array',
      items: ref('TextSearchAdapter'),
    },
    connections: { type: 'array', items: ref('Connection') },
    defaultSession: ref('Session'),
    preConfiguredSessions: { type: 'array', items: ref('Session') },
  }
  const rootProperties: Record<string, JsonSchema> = {
    $schema: {
      type: 'string',
      description:
        'The URL of this schema, so an editor can validate and complete the file.',
    },
  }
  for (const [key, prop] of Object.entries(
    unwrap(deps.configModel).type.properties ?? {},
  )) {
    rootProperties[key] = ROOT_OVERRIDES[key] ?? mstSchema(prop, 1)
  }

  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: deps.schemaId,
    title: 'JBrowse config.json',
    description: `The JBrowse ${deps.version} config.json: assemblies, tracks, connections, site-wide configuration and a default session. Generated from the registered types by \`pnpm autogen\`.`,
    ...closed(rootProperties),
    $defs: defs,
  }
}
