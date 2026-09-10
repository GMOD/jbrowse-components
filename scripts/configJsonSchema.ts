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
}

export interface SchemaMetadata {
  definition: Record<string, SlotDefinition | string | number | MstType>
  options: {
    explicitlyTyped?: boolean
    explicitIdentifier?: string
    implicitIdentifier?: string | boolean
    preProcessSnapshot?: (snap: unknown) => unknown
  }
}

export interface ElementEntry {
  name: string
  configSchema?: MstType
  stateModel?: MstType
  aliases?: string[]
  viewType?: string
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
    for (let i = 0; i < 16; i++) {
      if (cur.name === 'JexlString') {
        jexl = true
      }
      const sub = cur.getSubTypes()
      if (!sub || typeof sub !== 'object' || Array.isArray(sub)) {
        break
      }
      cur = sub
    }
    return { type: cur, jexl }
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
    const configName = configDefNames.get(raw)
    if (configName) {
      return ref(configName)
    }
    const meta = deps.metadataOf(raw)
    if (meta) {
      return configObject(raw, meta, depth)
    }
    const { type, jexl } = unwrap(raw)
    if (jexl) {
      return ref('JexlString')
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

  function builtinSlot(type: string): JsonSchema {
    switch (type) {
      case 'stringArray':
        return { type: 'array', items: { type: 'string' } }
      case 'stringArrayMap':
        return {
          type: 'object',
          additionalProperties: { type: 'array', items: { type: 'string' } },
        }
      case 'numberMap':
        return { type: 'object', additionalProperties: { type: 'number' } }
      case 'boolean':
      case 'maybeBoolean':
        return { type: 'boolean' }
      case 'color':
      case 'maybeColor':
      case 'string':
      case 'text':
        return { type: 'string' }
      case 'integer':
        return { type: 'integer' }
      case 'number':
      case 'maybeNumber':
        return { type: 'number' }
      case 'fileLocation':
        return ref('FileLocation')
      default:
        throw new Error(`no JSON Schema mapping for slot type "${type}"`)
    }
  }

  function slotSchema(
    def: SlotDefinition,
    depth: number,
    legacyValues?: unknown[],
  ): JsonSchema {
    const frozen = def.type === 'frozen' || def.type === 'maybeFrozen'
    const description = [def.description?.trim(), frozen ? FROZEN_NOTE : '']
      .filter((s): s is string => Boolean(s))
      .map(s => (/[.!?]$/.test(s) ? s : `${s}.`))
      .join(' ')
    const value = def.model
      ? mstSchema(def.model, depth)
      : frozen
        ? {}
        : builtinSlot(def.type)
    const withDefault =
      def.defaultValue === undefined ||
      typeof def.defaultValue === 'function' ||
      (typeof def.defaultValue === 'object' &&
        def.defaultValue !== null &&
        Object.keys(def.defaultValue).length === 0)
        ? {}
        : { default: def.defaultValue }
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
    return {
      ...(description ? { description } : {}),
      ...(frozen ? {} : { anyOf: [value, ...legacy, ref('JexlString')] }),
      ...withDefault,
    }
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
        properties[slot] = slotSchema(entry, depth + 1, legacyValues[slot])
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
    const { explicitIdentifier, implicitIdentifier } = meta.options
    const idName =
      explicitIdentifier ??
      (typeof implicitIdentifier === 'string'
        ? implicitIdentifier
        : implicitIdentifier
          ? 'id'
          : undefined)
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
      string: lifts('probe'),
      uri: lifts({ uri: 'probe' }),
    }
  }

  // An unregistered ConfigurationSchema, i.e. a sub-schema slot. Every track
  // schema builds its own `textSearching` and `formatDetails`, so identical
  // ones share one definition, named after the sub-schema.
  const sharedByContent = new Map<string, string>()
  function configObject(
    type: MstType,
    meta: SchemaMetadata,
    depth: number,
  ): JsonSchema {
    const name = type.name.replace(/ConfigurationSchema$/, '')
    const forms = liftedForms(meta)
    const properties = {
      ...identityOf(meta, name),
      ...slotTable(meta, depth),
      ...(forms.uri
        ? { uri: shorthandSchema('uri'), baseUri: shorthandSchema('baseUri') }
        : {}),
    }
    const object = closed(properties)
    const schema = forms.string
      ? {
          anyOf: [
            {
              type: 'string',
              description: `Shorthand for \`{ "${stringTarget(meta, properties)}": ... }\`.`,
            },
            object,
          ],
        }
      : object
    const content = `${name}:${JSON.stringify(schema)}`
    let shared = sharedByContent.get(content)
    if (!shared) {
      shared = name
      for (let i = 2; shared in defs; i++) {
        shared = `${name}${i}`
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

  // The slot a bare string lands on, read off the lift itself.
  function stringTarget(
    meta: SchemaMetadata,
    properties: Record<string, JsonSchema>,
  ) {
    const out = meta.options.preProcessSnapshot?.('probe') as
      | Record<string, unknown>
      | undefined
    return (
      Object.keys(out ?? {}).find(
        k => out?.[k] === 'probe' && k in properties,
      ) ?? 'value'
    )
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
      'A jexl callback evaluated when the slot is read, e.g. `jexl:get(feature, "score") > 10 ? "red" : "blue"`. Every slot accepts one in place of a fixed value.',
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
  registerConfigDefs('track', deps.elements.tracks, 'Track')
  registerConfigDefs(
    'text search adapter',
    deps.elements.textSearchAdapters,
    'TextSearchAdapter',
  )
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
  defs.TextSearchAdapter = union(
    deps.elements.textSearchAdapters,
    'A name-search index, built by `jbrowse text-index`.',
  )
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
    properties.displayDefaults = {
      title: `${track.name}DisplayDefaults`,
      description:
        "Display settings routed to whichever of this track's displays declares each key, so the track need not name a display or write the `displays` array.",
      ...composed(
        displays.map(name => `${name}Slots`),
        {},
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
          'Legacy display-instance key: a session migration lifts it onto the config slot that replaced it.',
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
        d.viewType === view.name &&
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
    if (kind === 'highlightEntries') {
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

  defs.PluginDefinition = {
    title: 'PluginDefinition',
    description:
      'A plugin to load: its name plus a `url`/`umdUrl`/`esmUrl`/`cjsUrl`, or `umdLoc`/`esmLoc`/`cjsLoc` for a file relative to the config.',
    type: 'object',
    properties: {
      name: { type: 'string' },
      url: { type: 'string' },
      umdUrl: { type: 'string' },
      esmUrl: { type: 'string' },
      cjsUrl: { type: 'string' },
      umdLoc: ref('FileLocation'),
      esmLoc: ref('FileLocation'),
      cjsLoc: ref('FileLocation'),
    },
    required: ['name'],
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
