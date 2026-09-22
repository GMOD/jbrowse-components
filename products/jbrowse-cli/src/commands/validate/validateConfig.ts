// Checks a JBrowse config (or a saved session file): the generated JSON Schema
// first, which reports every key or value the schema can judge, then the
// cross-references a schema cannot express and the warnings for stale
// spellings a migration still rewrites.
//
// Why a validator at all, given MST type-checks a config on load: MST models
// ignore snapshot keys they do not declare, so a misspelt slot leaves the track
// loading normally with the setting doing nothing.
//
// Pure: no filesystem, no process exit. The command wrapper owns both.

import { configManifest } from './configManifest.generated.ts'
import { displayDefaultsForTrackType } from './displayDefaultKeys.ts'
import { isRecord, liftToSnapshot } from './liftConfig.ts'
import { colorProblems, fieldScaleOf } from './markRules/colorScale.ts'
import { markProblems } from './markRules/markProblems.ts'
import {
  hasDeclaredShape,
  rootConfigurationSlots,
  schemaProblems,
} from './schemaValidate.ts'
import { didYouMean } from './suggest.ts'

import type { MarkSnapshot, StepSnapshot } from './markRules/markProblems.ts'
import type {
  ConfigManifest,
  Problem,
  SlotEntry,
  TypeGroup,
  ValidationResult,
} from './types.ts'

class Report {
  problems: Problem[] = []
  notes: string[] = []

  error(where: string, message: string) {
    this.problems.push({ level: 'error', where, message })
  }

  warn(where: string, message: string) {
    this.problems.push({ level: 'warning', where, message })
  }

  note(message: string) {
    this.notes.push(message)
  }

  result(): ValidationResult {
    return {
      problems: this.problems,
      notes: this.notes,
      errorCount: this.problems.filter(p => p.level === 'error').length,
      warningCount: this.problems.filter(p => p.level === 'warning').length,
    }
  }
}

// A declared `sequenceAdapter` works and is simply the wrong way round: every
// feature adapter takes its sequence from the assembly the track is displayed
// against, so a hand-written one pins the track to that source. An undeclared
// one is the schema's unknown-key error, with its own message there.
const SELF_SUPPLIED: Record<string, string> = {
  sequenceAdapter:
    '`sequenceAdapter` is set by hand. JBrowse takes the sequence from the assembly the track is displayed against, so this is only needed to read some OTHER sequence — and it pins the track to that source even when the assembly changes. Delete it unless that is what you meant',
}

// The warnings a slot table carries: a legacy key or value a migration
// rewrites, and a declared key JBrowse fills in for itself.
function warnSlots(
  obj: Record<string, unknown>,
  entry: {
    slots: SlotEntry[]
    legacyKeys?: string[]
    legacyValues?: Record<string, unknown[]>
  },
  where: string,
  report: Report,
) {
  const declared = new Set(entry.slots.map(s => s.name))
  for (const [key, value] of Object.entries(obj)) {
    if (declared.has(key) && SELF_SUPPLIED[key]) {
      report.warn(`${where}.${key}`, SELF_SUPPLIED[key])
    } else if (entry.legacyValues?.[key]?.includes(value)) {
      report.warn(
        `${where}.${key}`,
        `${JSON.stringify(value)} is a legacy value of "${key}" that a migration rewrites — the config loads, but the current spelling is one of the enum's members`,
      )
    } else if (!declared.has(key) && entry.legacyKeys?.includes(key)) {
      report.warn(
        `${where}.${key}`,
        `"${key}" is a legacy key that a migration rewrites into current slots — the config loads, but check the settings inside it landed`,
      )
    }
  }
  for (const slot of entry.slots) {
    const value = obj[slot.name]
    if (!slot.subSlots) {
      continue
    }
    for (const [item, suffix] of isRecord(value)
      ? [[value, ''] as const]
      : Array.isArray(value)
        ? value.map((v, i) => [v, `[${i}]`] as const)
        : []) {
      if (isRecord(item)) {
        warnSlots(
          item,
          { slots: slot.subSlots },
          `${where}.${slot.name}${suffix}`,
          report,
        )
      }
    }
  }
}

// Resolves a `type` against one of the manifest's groups. An unregistered type
// is a warning: MST is loud about it on load, and a plugin registers types the
// manifest never saw.
function resolveType<Entry extends { aliases?: string[] }>(
  obj: Record<string, unknown>,
  group: Record<string, Entry>,
  groupLabel: string,
  where: string,
  report: Report,
): (Entry & { canonicalName: string }) | undefined {
  const typeName = obj.type
  if (typeof typeName !== 'string') {
    return undefined
  }
  const canonical =
    typeName in group
      ? typeName
      : Object.keys(group).find(name =>
          group[name]!.aliases?.includes(typeName),
        )
  const entry = canonical === undefined ? undefined : group[canonical]
  if (entry && canonical !== undefined) {
    return { ...entry, canonicalName: canonical }
  }
  report.warn(
    where,
    `${groupLabel} type "${typeName}" is not registered by the core plugins${didYouMean(typeName, Object.keys(group))} — it may come from a plugin`,
  )
  return undefined
}

function checkPluggable(
  obj: unknown,
  group: TypeGroup,
  groupLabel: string,
  where: string,
  report: Report,
) {
  if (!isRecord(obj)) {
    return
  }
  const entry = resolveType(obj, group, groupLabel, `${where}.type`, report)
  if (entry) {
    warnSlots(obj, entry, where, report)
  }
}

interface Ctx {
  assemblyNames: Set<string>
  // assemblies, not names: aliases put one assembly under several names, and
  // a loose track's implied assembly is only unambiguous when there is one
  assemblyCount: number
  seenTrackIds: Set<string>
  // every id a session may legally name: the tracks plus each assembly's
  // ReferenceSequenceTrack, which lives on the assembly rather than in `tracks`
  sequenceTrackIds: Set<string>
  // a declared plugin registers slots and creates tracks at runtime, so what
  // only a plugin could supply is a warning here and an error without one
  declaresPlugins: boolean
}

function checkTrack(
  track: Record<string, unknown>,
  index: number,
  manifest: ConfigManifest,
  report: Report,
  ctx: Ctx,
) {
  const where = `tracks[${index}]`
  const loose = typeof track.uri === 'string' && !('adapter' in track)

  const trackId = track.trackId
  if (typeof trackId === 'string' && trackId) {
    if (ctx.seenTrackIds.has(trackId)) {
      report.error(
        `${where}.trackId`,
        `duplicate trackId "${trackId}" — a later track with the same id shadows the earlier one`,
      )
    } else {
      ctx.seenTrackIds.add(trackId)
    }
  }

  const names = track.assemblyNames
  if (!Array.isArray(names) || names.length === 0) {
    if (!loose || ctx.assemblyCount !== 1) {
      report.error(`${where}.assemblyNames`, 'missing "assemblyNames"')
    }
  } else {
    for (const name of names) {
      if (typeof name === 'string' && !ctx.assemblyNames.has(name)) {
        // The connection caveat leads and the spelling guess trails: a
        // connection added at runtime can supply the assembly, and a guess
        // called a working config a typo.
        report.error(
          `${where}.assemblyNames`,
          `assembly "${name}" is not defined in this config, and no connection here supplies one — though a connection added at runtime can${didYouMean(name, [...ctx.assemblyNames])}`,
        )
      }
    }
  }

  checkPluggable(track, manifest.tracks, 'track', where, report)
  if (!loose) {
    checkPluggable(
      track.adapter,
      manifest.adapters,
      'adapter',
      `${where}.adapter`,
      report,
    )
  }
  const textSearching = track.textSearching
  if (isRecord(textSearching)) {
    checkPluggable(
      textSearching.textSearchAdapter,
      manifest.textSearchAdapters,
      'text search adapter',
      `${where}.textSearching.textSearchAdapter`,
      report,
    )
  }
  if (Array.isArray(track.displays)) {
    for (const [i, display] of track.displays.entries()) {
      checkPluggable(
        display,
        manifest.displays,
        'display',
        `${where}.displays[${i}]`,
        report,
      )
    }
  }
}

function checkAssembly(
  assembly: Record<string, unknown>,
  index: number,
  manifest: ConfigManifest,
  report: Report,
) {
  const sequence = assembly.sequence
  if (isRecord(sequence) && isRecord(sequence.adapter)) {
    checkPluggable(
      sequence.adapter,
      manifest.adapters,
      'adapter',
      `assemblies[${index}].sequence.adapter`,
      report,
    )
  }
}

// A display node inside a session is instantiated by the display's state
// model; the schema reports a key it does not declare. What remains here is
// the legacy display-instance key a session migration still lifts.
function checkSessionDisplay(
  display: Record<string, unknown>,
  manifest: ConfigManifest,
  where: string,
  report: Report,
) {
  const entry = resolveType(
    display,
    manifest.displays,
    'display',
    `${where}.type`,
    report,
  )
  if (!entry?.stateModelProps) {
    return
  }
  const migrated = new Set([
    ...(manifest.migratedDisplayKeys['*'] ?? []),
    ...(manifest.migratedDisplayKeys[entry.canonicalName] ?? []),
  ])
  for (const key of Object.keys(display)) {
    if (!entry.stateModelProps.includes(key) && migrated.has(key)) {
      report.warn(
        `${where}.${key}`,
        `"${key}" is a legacy display-instance key that a session migration lifts onto the config slot replacing it — it still works, but writing the current slot is clearer`,
      )
    }
  }
}

// Walks the tracks of a view and its sub-views (a synteny view holds a row of
// LGVs, each with tracks of its own).
function checkSessionViewTracks(
  view: unknown,
  manifest: ConfigManifest,
  where: string,
  report: Report,
) {
  if (!isRecord(view)) {
    return
  }
  if (Array.isArray(view.tracks)) {
    for (const [i, track] of view.tracks.entries()) {
      if (!isRecord(track) || !Array.isArray(track.displays)) {
        continue
      }
      for (const [j, display] of track.displays.entries()) {
        if (isRecord(display)) {
          checkSessionDisplay(
            display,
            manifest,
            `${where}.tracks[${i}].displays[${j}]`,
            report,
          )
        }
      }
    }
  }
  if (Array.isArray(view.views)) {
    for (const [i, sub] of view.views.entries()) {
      checkSessionViewTracks(sub, manifest, `${where}.views[${i}]`, report)
    }
  }
}

// The ids a view names, which nothing validates at load: a trackId that does not
// exist simply fails to open, which reads as a rendering bug rather than a typo.
function checkViewReferences(
  view: Record<string, unknown>,
  where: string,
  report: Report,
  ctx: Ctx,
) {
  const assembly = view.assembly
  if (typeof assembly === 'string' && !ctx.assemblyNames.has(assembly)) {
    report.error(
      `${where}.assembly`,
      `assembly "${assembly}" is not defined in this config${didYouMean(assembly, [...ctx.assemblyNames])}`,
    )
  }
  if (!Array.isArray(view.tracks)) {
    return
  }
  // A LinearSyntenyView's `tracks` is one array per level, so flatten one level
  // before reading entries.
  const entries = view.tracks.flatMap((t: unknown) =>
    Array.isArray(t) ? (t as unknown[]) : [t],
  )
  for (const [j, entry] of entries.entries()) {
    // A built track snapshot names its config through `configuration` rather
    // than `trackId`, and is state MST restores rather than a reference to open.
    if (isRecord(entry) && !('trackId' in entry)) {
      continue
    }
    const trackId = isRecord(entry) ? entry.trackId : entry
    if (
      typeof trackId === 'string' &&
      !ctx.seenTrackIds.has(trackId) &&
      !ctx.sequenceTrackIds.has(trackId)
    ) {
      const message = `trackId "${trackId}" is not defined in this config${didYouMean(trackId, [...ctx.seenTrackIds, ...ctx.sequenceTrackIds])}`
      if (ctx.declaresPlugins) {
        report.warn(
          `${where}.tracks[${j}]`,
          `${message} — a plugin it declares may create it`,
        )
      } else {
        report.error(`${where}.tracks[${j}]`, message)
      }
    }
  }
}

function checkSessionView(
  view: Record<string, unknown>,
  manifest: ConfigManifest,
  where: string,
  report: Report,
  ctx: Ctx,
) {
  const entry = resolveType(
    view,
    manifest.views,
    'view',
    `${where}.type`,
    report,
  )
  if (!entry) {
    return
  }
  checkViewReferences(view, where, report, ctx)

  // A warning, not an error: v5 unwraps the nesting on the way in, so the
  // settings do arrive.
  if (view.init !== undefined) {
    report.warn(
      `${where}.init`,
      'settings nested under "init", which is deprecated: write every setting directly on the view object',
    )
    if (isRecord(view.init)) {
      checkViewReferences(view.init, `${where}.init`, report, ctx)
    }
  }

  // A synteny or breakpoint row is a whole view snapshot of its own. A row
  // written as a recipe names no view type, and which one it becomes is the
  // parent launcher's business.
  if (Array.isArray(view.views)) {
    for (const [i, row] of view.views.entries()) {
      if (isRecord(row) && typeof row.type === 'string') {
        checkSessionView(row, manifest, `${where}.views[${i}]`, report, ctx)
      }
    }
  }
}

function checkSession(
  session: unknown,
  manifest: ConfigManifest,
  report: Report,
  ctx: Ctx,
) {
  if (!isRecord(session) || !Array.isArray(session.views)) {
    return
  }
  for (const [i, view] of session.views.entries()) {
    checkSessionViewTracks(view, manifest, `defaultSession.views[${i}]`, report)
  }
  for (const [i, view] of session.views.entries()) {
    if (isRecord(view)) {
      checkSessionView(
        view,
        manifest,
        `defaultSession.views[${i}]`,
        report,
        ctx,
      )
    }
  }
}

const MARK_DISPLAY = 'LinearMarkDisplay'
const SLOTS_POINTER = `/$defs/${MARK_DISPLAY}Slots/properties`

// The rule list reads a config snapshot, which is what a file is once the
// schema passes its keys and types and the manifest's lifts are applied. An
// entry the schema refuses is the schema's to report, and stands as a gap so
// its siblings keep their indices and their own reports.
function declaredEntries<T>(
  lifted: Record<string, unknown>,
  display: Record<string, unknown>,
  slot: string,
): (T | undefined)[] {
  const list = lifted[slot]
  const written = display[slot]
  return Array.isArray(list) && Array.isArray(written)
    ? list.map((entry, i) =>
        hasDeclaredShape(written[i], `${SLOTS_POINTER}/${slot}/items`)
          ? (entry as T)
          : undefined,
      )
    : []
}

function slotPath(slot: string) {
  return slot.replaceAll(/\.(\d+)(?=\.|$)/g, '[$1]')
}

// A mark display's own entry, whose marks may come from `displayDefaults`, or
// a `displayDefaults` holding marks. A mark is a record with a `transform` of
// its own, so an untyped node counts only by its `marks`.
function holdsMarkRules(node: Record<string, unknown>) {
  return node.type === MARK_DISPLAY
    ? Array.isArray(node.marks) || Array.isArray(node.transform)
    : node.type === undefined && Array.isArray(node.marks)
}

// What the marks of one display say together that it cannot draw as written:
// the rule list the display shows in its corner notice, copied from the plugin
// (`markRules/`). A single mark's `requires` is the schema's to report.
function checkMarkDisplay(
  display: Record<string, unknown>,
  manifest: ConfigManifest,
  where: string,
  report: Report,
) {
  const slots = manifest.displays[MARK_DISPLAY]?.slots
  const lifted = liftToSnapshot(display, slots ?? [])
  if (!slots || !isRecord(lifted)) {
    return
  }
  const { facet } = lifted
  for (const { level, rule, mark, slot, message } of markProblems(
    declaredEntries<MarkSnapshot>(lifted, display, 'marks'),
    isRecord(facet) ? facet : undefined,
    declaredEntries<StepSnapshot>(lifted, display, 'transform'),
  )) {
    report.problems.push({
      level,
      where: `${where}${mark === undefined ? '' : `.marks[${mark}]`}.${slotPath(slot)}`,
      message,
      rule,
    })
  }
}

// The display's own colour rules, with its schema's fieldScale standing in
// for the plugin code the CLI does not run
function checkColorSlots(
  display: Record<string, unknown>,
  slots: SlotEntry[],
  where: string,
  report: Report,
) {
  const lifted = liftToSnapshot(display, slots)
  if (!isRecord(lifted)) {
    return
  }
  for (const { name, fieldScale, subSlots = [] } of slots) {
    const written = lifted[name]
    if (!fieldScale || !isRecord(written)) {
      continue
    }
    const declared = new Set(subSlots.map(slot => slot.name))
    const color = Object.fromEntries(
      Object.entries(written).filter(([key]) => declared.has(key)),
    )
    const field = typeof color.field === 'string' ? color.field : ''
    for (const problem of colorProblems(
      {
        field,
        scale: typeof color.scale === 'string' ? color.scale : undefined,
        domain: Array.isArray(color.domain) ? color.domain : undefined,
        range: Array.isArray(color.range) ? color.range : undefined,
        domainMin:
          typeof color.domainMin === 'number' ? color.domainMin : undefined,
        domainMax:
          typeof color.domainMax === 'number' ? color.domainMax : undefined,
      },
      fieldScaleOf(fieldScale, field),
    )) {
      const at = `${where}.${name}.${problem.slot}`
      if (
        !report.problems.some(p => p.where === at && p.rule === problem.rule)
      ) {
        report.problems.push({
          level: 'warning',
          where: at,
          message: problem.message,
          rule: problem.rule,
        })
      }
    }
  }
}

// A marks list sits wherever a config takes the mark display's slots: a
// track's `displays` entry, its `displayDefaults`, a session's inline track
// entry. No other type declares `marks`, so the walk is over the whole file,
// past a place where the schema refused the key: a session display node
// drops it.
function checkMarkDisplays(
  node: unknown,
  manifest: ConfigManifest,
  where: string,
  report: Report,
) {
  if (Array.isArray(node)) {
    for (const [i, item] of node.entries()) {
      checkMarkDisplays(item, manifest, `${where}[${i}]`, report)
    }
  } else if (isRecord(node)) {
    const colorSlots =
      typeof node.type === 'string'
        ? manifest.displays[node.type]?.slots
        : undefined
    if (colorSlots) {
      checkColorSlots(node, colorSlots, where, report)
    }
    if (typeof node.type === 'string' && isRecord(node.displayDefaults)) {
      for (const display of displayDefaultsForTrackType(node.type, manifest)
        .displayTypes) {
        checkColorSlots(
          node.displayDefaults,
          manifest.displays[display]?.slots ?? [],
          `${where}.displayDefaults`,
          report,
        )
      }
    }
    if (
      holdsMarkRules(node) &&
      !report.problems.some(p => p.where === `${where}.marks`)
    ) {
      checkMarkDisplay(node, manifest, where, report)
    }
    for (const [key, member] of Object.entries(node)) {
      checkMarkDisplays(
        member,
        manifest,
        where ? `${where}.${key}` : key,
        report,
      )
    }
  }
}

export function validateConfig(
  config: unknown,
  manifest: ConfigManifest = configManifest,
): ValidationResult {
  const report = new Report()
  if (!isRecord(config)) {
    report.error('', 'config is not a JSON object')
    return report.result()
  }
  const declaresPlugins =
    Array.isArray(config.plugins) && config.plugins.length > 0
  if (declaresPlugins) {
    report.note(
      `config declares ${(config.plugins as unknown[]).length} plugin(s); the types and slots they register are not in the schema and cannot be checked`,
    )
  }

  const { configuration } = config
  const pluginSlots =
    declaresPlugins && isRecord(configuration)
      ? Object.keys(configuration).filter(k => !rootConfigurationSlots.has(k))
      : []
  for (const key of pluginSlots) {
    report.warn(
      `configuration.${key}`,
      `core declares no "${key}" slot${didYouMean(key, [...rootConfigurationSlots])} — a plugin this config declares may`,
    )
  }
  report.problems.push(
    ...schemaProblems(
      pluginSlots.length && isRecord(configuration)
        ? {
            ...config,
            configuration: Object.fromEntries(
              Object.entries(configuration).filter(
                ([k]) => !pluginSlots.includes(k),
              ),
            ),
          }
        : config,
    ),
  )

  const assemblies = (
    Array.isArray(config.assemblies)
      ? config.assemblies
      : isRecord(config.assembly)
        ? [config.assembly]
        : []
  ).filter(isRecord)
  if (assemblies.length === 0) {
    report.error('assemblies', 'no assemblies — a config needs at least one')
  }

  const ctx: Ctx = {
    // An assembly's `aliases` are usable wherever its name is.
    assemblyNames: new Set(
      assemblies
        .flatMap(a => [a.name, ...(Array.isArray(a.aliases) ? a.aliases : [])])
        .filter((n): n is string => typeof n === 'string'),
    ),
    assemblyCount: assemblies.length,
    seenTrackIds: new Set(),
    declaresPlugins,
    // Both the written trackId and the one the `{name, uri}` shorthand derives,
    // since a config using the shorthand still gets the derived id at runtime.
    sequenceTrackIds: new Set(
      assemblies.flatMap(a => {
        const declared = isRecord(a.sequence) ? a.sequence.trackId : undefined
        return [
          ...(typeof declared === 'string' ? [declared] : []),
          ...(typeof a.name === 'string'
            ? [`${a.name}-ReferenceSequenceTrack`]
            : []),
        ]
      }),
    ),
  }

  for (const [i, assembly] of assemblies.entries()) {
    checkAssembly(assembly, i, manifest, report)
  }

  const tracks = Array.isArray(config.tracks)
    ? config.tracks.filter(isRecord)
    : []
  for (const [i, track] of tracks.entries()) {
    checkTrack(track, i, manifest, report, ctx)
  }

  const connections = Array.isArray(config.connections)
    ? config.connections
    : []
  for (const [i, connection] of connections.entries()) {
    checkPluggable(
      connection,
      manifest.connections,
      'connection',
      `connections[${i}]`,
      report,
    )
  }

  const aggregate = Array.isArray(config.aggregateTextSearchAdapters)
    ? config.aggregateTextSearchAdapters
    : []
  for (const [i, adapter] of aggregate.entries()) {
    checkPluggable(
      adapter,
      manifest.textSearchAdapters,
      'text search adapter',
      `aggregateTextSearchAdapters[${i}]`,
      report,
    )
  }

  // Tracks are registered before the session is checked, so a session may
  // reference any track in the file regardless of declaration order.
  checkSession(config.defaultSession, manifest, report, ctx)
  checkMarkDisplays(config, manifest, '', report)

  return report.result()
}
