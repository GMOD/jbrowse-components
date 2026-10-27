// The v4.3.0 spellings a v5 build still reads, and where each lands, for the
// table on website/docs/config_guides/v4_migration.md. `migrationRows` runs
// inside the introspection bundle generateConfigManifest.ts builds, so every
// handle arrives through `deps`; `migrationTableLines` formats its rows
// outside it.
//
// A landing is what the lift writes over a set of probe values, kept where the
// schema declares the path. A lift writing nothing for every probe is a drop.

import type { SchemaMetadata } from './configJsonSchema.ts'

type Snap = Record<string, unknown>
type Lift = (value: unknown) => unknown

interface ElementLike {
  name: string
  configSchema?: unknown
  retiredTypes?: readonly {
    type: string
    migrate?: (entry: Snap) => Snap
  }[]
  retiredState?: { keys: readonly string[] }
  trackType?: string | readonly string[]
  viewType?: string
}

interface ViewLike {
  name: string
  stateModel: unknown
  displayTypes: readonly { name: string }[]
}

interface ManifestEntry {
  legacyKeys?: string[]
  legacyValues?: Record<string, unknown[]>
  droppedDisplays?: string[]
  passThrough?: string[]
  builtTracksAt?: string
}

export interface MigrationDeps {
  /** the registered elements by manifest group */
  groups: Record<string, readonly ElementLike[]>
  views: readonly ViewLike[]
  manifest: Record<string, Record<string, ManifestEntry>>
  metadataOf: (type: unknown) => SchemaMetadata | undefined
  liftRetiredSpellings: (meta: SchemaMetadata, snap: Snap) => Snap
  preProcessorOf: (stateModel: unknown) => ((snap: Snap) => Snap) | undefined
  /** the app's session migration, `migrateSessionSnapshot` */
  migrateSession: (session: Snap) => Snap
  /** the display-instance keys any display's session migration lifts */
  everyDisplaySessionKeys: readonly string[]
  /** the display keys a v4.3.0 synteny view's displays carried, by display */
  syntenyDisplayKeys: Record<string, readonly string[]>
  /** the v4 keys a synteny view converts on itself */
  syntenyViewKeys: readonly string[]
  /** the manifest's probe value for each legacy key it tries */
  candidates: Record<string, unknown>
}

export interface MigrationRow {
  /** the manifest group, which orders the table */
  group: string
  /** the types answering the spelling */
  owners: string[]
  /** the v4 key, or for `kind: 'type'` the v4 display type */
  key: string
  kind: 'key' | 'type' | 'value'
  /** written on a display or view in a saved session, not in config.json */
  session: boolean
  /** slot paths, or `path: value` pairs a type or value sets; empty drops */
  lands: string[]
  /** the type the slots belong to, where it is not the owner */
  on?: string
}

export interface Migration {
  rows: MigrationRow[]
  /** every type of each group, so a row every one answers says so */
  typesByGroup: Record<string, string[]>
}

const COLOR = '#123456'

// Flags, sizes, a color, a list, an empty object, and the enum names v4's
// scale and plot keys spelt
const PROBES: unknown[] = [
  true,
  false,
  7,
  0.5,
  'probe',
  COLOR,
  'log',
  'local',
  'max',
  'strand',
  'density',
  'compact',
  ['probe'],
  {},
]

// v4 keys whose value is a block of settings no generic probe fills in
const SHAPED: Record<string, unknown[]> = {
  colorBy: [{ type: 'strand' }, { type: 'perBaseQuality' }],
  colorBySetting: [{ type: 'strand' }, { type: 'perBaseQuality' }],
  renderer: [{ color1: COLOR, color3: COLOR, strokeColor: COLOR }],
  renderers: [
    {
      PileupRenderer: {
        height: 7,
        maxHeight: 7,
        hideMismatches: true,
        mismatchAlpha: true,
      },
    },
    { XYPlotRenderer: { color: COLOR, summaryScoreMode: 'max' } },
  ],
  pileupDisplay: [{ featureHeight: 7, maxHeight: 7 }],
  snpCoverageDisplay: [{ height: 7, minScore: 1 }],
  defaultRendering: ['xyplot', 'line'],
  sortedBy: [{ type: 'Base pair', pos: 1, refName: 'probe' }],
  filterBy: [{ flagInclude: 1 }],
  filterBySetting: [{ flagInclude: 1 }],
  PileupDisplay: [{ colorBySetting: { type: 'strand' }, trackMaxHeight: 7 }],
  SNPCoverageDisplay: [{ scale: 'log', displayCrossHatches: true }],
  constraints: [{ min: 1, max: 7 }],
  layout: [[{ name: 'probe', color: COLOR }]],
  minAlignmentLength: [1000],
}

const GROUP_ORDER = [
  'adapters',
  'textSearchAdapters',
  'tracks',
  'displays',
  'connections',
  'internetAccounts',
  'views',
]

function isSnap(value: unknown): value is Snap {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

// A lift names a value it cannot read on the console, and a probe hands it
// plenty
function quietly<T>(run: () => T): T | undefined {
  const { warn, error } = console
  console.warn = () => {}
  console.error = () => {}
  try {
    return run()
  } catch {
    return undefined
  } finally {
    console.warn = warn
    console.error = error
  }
}

function leaves(node: unknown, at = '', out = new Map<string, unknown>()) {
  if (isSnap(node) && Object.keys(node).length > 0) {
    for (const [key, value] of Object.entries(node)) {
      leaves(value, at ? `${at}.${key}` : key, out)
    }
  } else if (at) {
    out.set(at, node)
  }
  return out
}

/**
 * The part of `path` the schema declares: down through each sub-schema to the
 * slot, whose value's own members are the slot's business. Undefined where a
 * step names nothing its schema declares, which a closed schema drops.
 */
function declaredPath(
  deps: MigrationDeps,
  meta: SchemaMetadata,
  path: string,
): string | undefined {
  const kept: string[] = []
  let at: SchemaMetadata | undefined = meta
  for (const step of path.split('.')) {
    if (!at) {
      break
    }
    if (!Object.hasOwn(at.definition, step)) {
      return undefined
    }
    kept.push(step)
    const entry = at.definition[step]
    at = quietly(() => deps.metadataOf(entry))
  }
  return kept.join('.')
}

/**
 * The declared slots `lift` writes over the probe values, leaving out what
 * `baseline` already holds: a retired type's `migrate` sets its own slots
 * whatever the key holds.
 */
function landings(
  deps: MigrationDeps,
  meta: SchemaMetadata,
  key: string,
  lift: Lift,
  baseline: unknown = {},
) {
  const before = leaves(baseline)
  const found = new Set<string>()
  for (const probe of [
    ...(SHAPED[key] ?? []),
    ...(key in deps.candidates ? [deps.candidates[key]] : []),
    ...PROBES,
  ]) {
    for (const [path, value] of leaves(quietly(() => lift(probe)))) {
      const declared =
        JSON.stringify(before.get(path)) === JSON.stringify(value)
          ? undefined
          : declaredPath(deps, meta, path)
      if (declared) {
        found.add(declared)
      }
    }
  }
  return [...found].sort()
}

function subSchemas(deps: MigrationDeps, meta: SchemaMetadata) {
  return Object.entries(meta.definition).flatMap(([name, entry]) => {
    const sub = quietly(() => deps.metadataOf(entry))
    return sub ? [[name, sub] as const] : []
  })
}

// One row per spelling and landing, so a lift every track inherits is one row
function collect(rows: MigrationRow[], row: MigrationRow) {
  const id = (r: MigrationRow) =>
    JSON.stringify([r.group, r.key, r.kind, r.session, r.lands, r.on])
  const same = rows.find(r => id(r) === id(row))
  if (same) {
    same.owners.push(...row.owners)
  } else {
    rows.push(row)
  }
}

function retiredKeyRows(
  deps: MigrationDeps,
  group: string,
  element: ElementLike,
  meta: SchemaMetadata,
  prefix: string,
  rows: MigrationRow[],
) {
  const retired = (meta.options.retired ?? {}) as Record<string, Lift>
  for (const [key, lift] of Object.entries(retired)) {
    if (!Object.hasOwn(meta.definition, key)) {
      collect(rows, {
        group,
        owners: [element.name],
        key: `${prefix}${key}`,
        kind: 'key',
        session: false,
        lands: landings(deps, meta, key, lift).map(p => `${prefix}${p}`),
      })
    }
  }
  for (const [name, sub] of subSchemas(deps, meta)) {
    retiredKeyRows(deps, group, element, sub, `${prefix}${name}.`, rows)
  }
}

// The keys each retired type's `migrate` reads off an entry
function migrateReadKeys(
  type: string,
  migrate: ((entry: Snap) => Snap) | undefined,
) {
  const read = new Set<string>()
  quietly(() =>
    migrate?.(
      new Proxy(
        { type },
        {
          get(target, key) {
            if (typeof key === 'string') {
              read.add(key)
            }
            return Reflect.get(target, key)
          },
        },
      ),
    ),
  )
  read.delete('type')
  return [...read]
}

// A legacy key the schema's own preProcessSnapshot lifts rather than `retired`
function preProcessedKeyRows(
  deps: MigrationDeps,
  group: string,
  element: ElementLike,
  meta: SchemaMetadata,
  rows: MigrationRow[],
) {
  const pre = meta.options.preProcessSnapshot
  const retired = meta.options.retired ?? {}
  const readByMigrate = new Set(
    (element.retiredTypes ?? []).flatMap(r =>
      migrateReadKeys(r.type, r.migrate),
    ),
  )
  for (const key of deps.manifest[group]?.[element.name]?.legacyKeys ?? []) {
    if (pre && !(key in retired) && !readByMigrate.has(key)) {
      const lift: Lift = value => {
        const { [key]: _gone, ...rest } = pre({ [key]: value }) as Snap
        return rest
      }
      rows.push({
        group,
        owners: [element.name],
        key,
        kind: 'key',
        session: false,
        lands: landings(deps, meta, key, lift),
      })
    }
  }
}

function retiredTypeRows(
  deps: MigrationDeps,
  element: ElementLike,
  meta: SchemaMetadata,
  rows: MigrationRow[],
) {
  const declared = new Set(Object.keys(meta.definition))
  for (const { type, migrate } of element.retiredTypes ?? []) {
    const implied = quietly(() => migrate?.({ type })) ?? {}
    const settings = leaves(implied)
    settings.delete('type')
    rows.push({
      group: 'displays',
      owners: [element.name],
      key: type,
      kind: 'type',
      session: false,
      lands: [...settings].map(
        ([path, value]) => `${path}: ${JSON.stringify(value)}`,
      ),
      on: element.name,
    })
    for (const key of migrateReadKeys(type, migrate)) {
      if (migrate && !declared.has(key)) {
        const lift: Lift = value => {
          const { type: _type, ...rest } = migrate({ type, [key]: value })
          return deps.liftRetiredSpellings(meta, rest)
        }
        rows.push({
          group: 'displays',
          owners: [type],
          key,
          kind: 'key',
          session: false,
          lands: landings(deps, meta, key, lift, implied),
          on: element.name,
        })
      }
    }
  }
}

function legacyValueRows(
  group: string,
  element: ElementLike,
  meta: SchemaMetadata,
  entry: ManifestEntry | undefined,
  rows: MigrationRow[],
) {
  const pre = meta.options.preProcessSnapshot
  for (const [slot, values] of Object.entries(entry?.legacyValues ?? {})) {
    for (const value of values) {
      const lifted = leaves(quietly(() => pre?.({ [slot]: value })))
      if (lifted.get(slot) !== value) {
        rows.push({
          group,
          owners: [element.name],
          key: `${slot}: ${JSON.stringify(value)}`,
          kind: 'value',
          session: false,
          lands: [...lifted].map(
            ([path, v]) => `${path}: ${JSON.stringify(v)}`,
          ),
        })
      }
    }
  }
}

function sessionStateRows(
  deps: MigrationDeps,
  element: ElementLike,
  meta: SchemaMetadata,
  rows: MigrationRow[],
) {
  const trackType = [element.trackType ?? []].flat()[0]
  if (!trackType || !element.viewType) {
    return
  }
  // the settings the session migration writes into the track's config for
  // one display instance
  const written = (instance: Snap) => {
    const migrated = deps.migrateSession({
      views: [
        {
          type: element.viewType,
          tracks: [
            {
              type: trackType,
              configuration: 'probe-track',
              displays: [
                {
                  type: element.name,
                  configuration: `probe-track-${element.name}`,
                  ...instance,
                },
              ],
            },
          ],
        },
      ],
      sessionTracks: [{ type: trackType, trackId: 'probe-track' }],
    })
    const [track] = (migrated.sessionTracks ?? []) as Snap[]
    const [display] = (track?.displays ?? []) as Snap[]
    const { type: _type, displayId: _id, ...settings } = display ?? {}
    return settings
  }
  for (const key of [
    ...deps.everyDisplaySessionKeys,
    ...(element.retiredState?.keys ?? []),
  ]) {
    collect(rows, {
      group: 'displays',
      owners: [element.name],
      key,
      kind: 'key',
      session: true,
      lands: landings(deps, meta, key, value => written({ [key]: value })),
    })
  }
}

// What a view's preprocessor writes on the view for `snap`, beside what it
// writes for `baseline`, leaving the tracks it carries out
function viewLandings(
  pre: (snap: Snap) => Snap,
  baseline: Snap,
  snaps: Snap[],
  key: string,
) {
  const strip = (out: Snap | undefined) => {
    const { type: _t, levels: _l, tracks: _k, launch: _a, ...rest } = out ?? {}
    delete rest[key]
    return leaves(rest)
  }
  const before = strip(quietly(() => pre(baseline)))
  const found = new Set<string>()
  for (const snap of snaps) {
    for (const [path, value] of strip(quietly(() => pre(snap)))) {
      if (JSON.stringify(before.get(path)) !== JSON.stringify(value)) {
        found.add(path)
      }
    }
  }
  return [...found].sort()
}

// v4.3.0's synteny displays held the color, opacity and length filter the
// view holds now, and its linear synteny view a flat `tracks` list
function viewRows(deps: MigrationDeps, rows: MigrationRow[]) {
  for (const view of deps.views) {
    const pre = deps.preProcessorOf(view.stateModel)
    const entry = deps.manifest.views?.[view.name]
    if (!pre) {
      continue
    }
    const shown = new Set(view.displayTypes.map(d => d.name))
    for (const [display, keys] of Object.entries(deps.syntenyDisplayKeys)) {
      if (!shown.has(display)) {
        continue
      }
      const withDisplay = (settings: Snap): Snap => {
        const track = {
          type: 'SyntenyTrack',
          configuration: 'probe',
          displays: [{ type: display, ...settings }],
        }
        return {
          type: view.name,
          levels: [{ tracks: [track] }],
          tracks: [track],
        }
      }
      for (const key of keys) {
        rows.push({
          group: 'displays',
          owners: [display],
          key,
          kind: 'key',
          session: true,
          lands: viewLandings(
            pre,
            withDisplay({}),
            [...(SHAPED[key] ?? []), ...PROBES].map(v =>
              withDisplay({ [key]: v }),
            ),
            key,
          ),
          on: view.name,
        })
      }
    }
    for (const key of deps.syntenyViewKeys) {
      if (entry?.passThrough?.includes(key)) {
        rows.push({
          group: 'views',
          owners: [view.name],
          key,
          kind: 'key',
          session: true,
          lands: viewLandings(
            pre,
            { type: view.name },
            [...(SHAPED[key] ?? []), ...PROBES].map(v => ({
              type: view.name,
              [key]: v,
            })),
            key,
          ),
        })
      }
    }
    if (entry?.builtTracksAt) {
      rows.push({
        group: 'views',
        owners: [view.name],
        key: 'tracks',
        kind: 'key',
        session: true,
        lands: [entry.builtTracksAt],
      })
    }
  }
}

export function migrationRows(deps: MigrationDeps): Migration {
  const rows: MigrationRow[] = []
  const registered = new Set((deps.groups.displays ?? []).map(d => d.name))
  const typesByGroup: Record<string, string[]> = {}
  for (const [group, elements] of Object.entries(deps.groups)) {
    for (const element of elements) {
      const meta = quietly(() => deps.metadataOf(element.configSchema))
      if (!meta) {
        continue
      }
      ;(typesByGroup[group] ??= []).push(element.name)
      const entry = deps.manifest[group]?.[element.name]
      retiredKeyRows(deps, group, element, meta, '', rows)
      preProcessedKeyRows(deps, group, element, meta, rows)
      legacyValueRows(group, element, meta, entry, rows)
      if (group === 'displays') {
        retiredTypeRows(deps, element, meta, rows)
        sessionStateRows(deps, element, meta, rows)
      }
      for (const display of entry?.droppedDisplays ?? []) {
        if (!registered.has(display)) {
          rows.push({
            group,
            owners: [element.name],
            key: display,
            kind: 'type',
            session: false,
            lands: [],
          })
        }
      }
    }
  }
  viewRows(deps, rows)
  return {
    rows: rows.map(row => ({
      ...row,
      owners: [...new Set(row.owners)].sort(),
    })),
    typesByGroup,
  }
}

const NOUN: Record<string, string> = {
  adapters: 'adapter',
  textSearchAdapters: 'text search adapter',
  tracks: 'track',
  displays: 'display',
  connections: 'connection',
  internetAccounts: 'internet account',
  views: 'view',
}

const code = (s: string) => `\`${s}\``

// A row most of a group answers names the ones it skips
function ownerLabel(row: MigrationRow, typesByGroup: Record<string, string[]>) {
  const all = typesByGroup[row.group] ?? []
  const but = all.filter(name => !row.owners.includes(name)).sort()
  return row.owners.length > 2 && but.length < row.owners.length
    ? `Every ${NOUN[row.group]}${but.length ? ` but ${but.map(code).join(', ')}` : ''}`
    : row.owners.map(code).join(', ')
}

function landingCell(row: MigrationRow) {
  const slots = row.lands.map(code).join(', ')
  if (row.kind === 'type') {
    return row.on
      ? `${code(row.on)}${slots ? ` with ${slots}` : ''}`
      : 'dropped'
  }
  if (!slots) {
    return 'dropped'
  }
  return row.on ? `${slots} on ${code(row.on)}` : slots
}

function keyCell(row: MigrationRow) {
  return row.kind === 'type' ? `type ${code(row.key)}` : code(row.key)
}

/**
 * The rows as one table grouped by the types answering them, the type named
 * on its group's first row. Keys sharing a landing share a row.
 */
export function migrationTableLines({ rows, typesByGroup }: Migration) {
  const merged = new Map<
    string,
    { group: string; owner: string; keys: string[]; landing: string }
  >()
  for (const row of rows) {
    const owner = ownerLabel(row, typesByGroup)
    const landing = landingCell(row)
    const keyed = `${row.session ? 'session ' : ''}${row.kind}`
    const id = JSON.stringify([row.group, owner, keyed, landing])
    const at = merged.get(id)
    const key = `${keyCell(row)}${row.session ? ' (session)' : ''}`
    if (at) {
      at.keys.push(key)
    } else {
      merged.set(id, { group: row.group, owner, keys: [key], landing })
    }
  }
  const sorted = [...merged.values()].sort(
    (a, b) =>
      GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) ||
      Number(b.owner.startsWith('Every')) -
        Number(a.owner.startsWith('Every')) ||
      a.owner.localeCompare(b.owner, 'en') ||
      Number(a.keys[0]!.endsWith('(session)')) -
        Number(b.keys[0]!.endsWith('(session)')) ||
      Number(a.landing === 'dropped') - Number(b.landing === 'dropped') ||
      a.keys[0]!.localeCompare(b.keys[0]!, 'en'),
  )
  return sorted.map((row, i) => [
    sorted[i - 1]?.owner === row.owner ? '' : row.owner,
    row.keys.sort((a, b) => a.localeCompare(b, 'en')).join(', '),
    row.landing,
  ])
}
