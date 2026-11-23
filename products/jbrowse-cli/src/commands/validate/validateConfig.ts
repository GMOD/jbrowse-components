// Checks a JBrowse config (or a saved session file): the generated JSON Schema
// first, which reports every key or value the schema can judge, then the
// cross-references a schema cannot express and the warnings for stale
// spellings a migration still rewrites.
//
// Why a validator at all, given MST type-checks a config on load: a key no
// schema declares does nothing, named on the console by a display and dropped
// in silence by a track, an adapter or a session snapshot, so a misspelt slot
// leaves the track loading normally.
//
// Pure: no filesystem, no process exit. The command wrapper owns both.

import {
  fileNameOf,
  isKeyedWrites,
  isLooseTrackConfig,
  keyedInForce,
  matchFormat,
  trackTypeForAdapter,
} from '@jbrowse/add-track-core'

import { filterProblems } from './alignmentsFilterRules/filterFields.ts'
import { basesEntryProblems } from './alignmentsLayerRules/basesFilterRules.ts'
import {
  alleleEntryProblems,
  interbaseEntryProblems,
} from './alignmentsLayerRules/layerFilterRules.ts'
import { configManifest } from './configManifest.generated.ts'
import {
  canonicalTypeName,
  displayDefaultsForTrackType,
} from './displayDefaultKeys.ts'
import { isRecord, liftToSnapshot } from './liftConfig.ts'
import {
  colorProblems,
  colorSlotsOf,
  scaleEndProblems,
  scaleEndsOf,
  UNIVERSAL_FIELD_PRESETS,
  withImpliedField,
} from './markRules/colorScale.ts'
import { markProblems } from './markRules/markProblems.ts'
import {
  coreSchemaValidator,
  SEQUENCE_FROM_ASSEMBLY,
} from './schemaValidate.ts'
import { didYouMean, didYouMeanKey, suggest } from './suggest.ts'

import type { FieldPredicate } from './alignmentsFilterRules/filterRuleFacts.ts'
import type { ScaleProblem } from './markRules/colorScale.ts'
import type { MarkSnapshot, StepSnapshot } from './markRules/markProblems.ts'
import type { SchemaValidator } from './schemaValidate.ts'
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
  private seen = new Set<string>()

  // A problem two checks both reach, such as the y axis's ends on a mark
  // display, or a defaults key two displays judge alike, is reported once.
  add(problem: Problem) {
    const key = `${problem.where}\n${problem.rule ?? ''}\n${problem.message}`
    if (!this.seen.has(key)) {
      this.seen.add(key)
      this.problems.push(problem)
    }
  }

  error(where: string, message: string) {
    this.add({ level: 'error', where, message })
  }

  warn(where: string, message: string) {
    this.add({ level: 'warning', where, message })
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

// One object, or each entry of a list, with the path suffix naming it
function entriesOf(value: unknown) {
  return isRecord(value)
    ? [[value, ''] as const]
    : Array.isArray(value)
      ? value.map((v, i) => [v, `[${i}]`] as const)
      : []
}

// The warnings a slot table carries: a legacy key or value a migration
// rewrites, and a declared key JBrowse fills in for itself.
function warnSlots(
  obj: Record<string, unknown>,
  entry: {
    slots: SlotEntry[]
    legacyKeys?: string[]
    droppedKeys?: string[]
    legacyValues?: Record<string, unknown[]>
  },
  where: string,
  report: Report,
  manifest: ConfigManifest,
) {
  const declared = new Set(entry.slots.map(s => s.name))
  for (const [key, value] of Object.entries(obj)) {
    if (declared.has(key) && key === 'sequenceAdapter') {
      report.warn(
        `${where}.${key}`,
        `\`sequenceAdapter\` is set by hand. ${SEQUENCE_FROM_ASSEMBLY}, so this is only needed to read some OTHER sequence — and it pins the track to that source even when the assembly changes. Delete it unless that is what you meant`,
      )
    } else if (entry.legacyValues?.[key]?.includes(value)) {
      report.warn(
        `${where}.${key}`,
        `${JSON.stringify(value)} is a legacy value of "${key}" that a migration rewrites — the config loads, but the current spelling is one of the enum's members`,
      )
    } else if (!declared.has(key) && entry.legacyKeys?.includes(key)) {
      report.warn(
        `${where}.${key}`,
        entry.droppedKeys?.includes(key)
          ? `"${key}" is a legacy key that is never read. ${key === 'sequenceAdapter' ? `${SEQUENCE_FROM_ASSEMBLY}. ` : ''}The config loads, and the key can be deleted`
          : `"${key}" is a legacy key that a migration rewrites into current slots — the config loads, but check the settings inside it landed`,
      )
    }
  }
  for (const slot of entry.slots) {
    const value = obj[slot.name]
    if (slot.holds) {
      for (const [item, suffix] of entriesOf(value)) {
        checkPluggable(
          item,
          manifest.adapters,
          'adapter',
          `${where}.${slot.name}${suffix}`,
          report,
          manifest,
        )
      }
    }
    if (!slot.subSlots) {
      continue
    }
    for (const [item, suffix] of entriesOf(value)) {
      if (isRecord(item)) {
        warnSlots(
          item,
          { slots: slot.subSlots, legacyKeys: slot.legacyKeys },
          `${where}.${slot.name}${suffix}`,
          report,
          manifest,
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
) {
  const typeName = obj.type
  if (typeof typeName === 'string') {
    const canonicalName = canonicalTypeName(group, typeName)
    const entry = canonicalName === undefined ? undefined : group[canonicalName]
    if (entry && canonicalName !== undefined) {
      return { ...entry, canonicalName }
    }
    report.warn(
      where,
      `${groupLabel} type "${typeName}" is not registered by the core plugins${didYouMean(typeName, Object.keys(group))} — it may come from a plugin`,
    )
  }
  return undefined
}

function checkPluggable(
  obj: unknown,
  group: TypeGroup,
  groupLabel: string,
  where: string,
  report: Report,
  manifest: ConfigManifest,
) {
  if (!isRecord(obj)) {
    return
  }
  const entry = resolveType(obj, group, groupLabel, `${where}.type`, report)
  if (entry) {
    warnSlots(obj, entry, where, report, manifest)
  }
}

// After every track is read, since an alias may come before the track whose
// id it is
function checkTrackAliases(
  tracks: Record<string, unknown>[],
  report: Report,
  ctx: Ctx,
) {
  for (const [i, track] of tracks.entries()) {
    const aliases = listOf(track.aliases)
    const trackId = typeof track.trackId === 'string' ? track.trackId : ''
    for (const [j, alias] of aliases.entries()) {
      const where = `tracks[${i}].aliases[${j}]`
      if (typeof alias === 'string') {
        if (ctx.seenTrackIds.has(alias) || ctx.sequenceTrackIds.has(alias)) {
          report.error(
            where,
            `"${alias}" is a trackId, which wins over an alias, so this alias never resolves`,
          )
        } else if (ctx.trackAliases.has(alias)) {
          report.error(
            where,
            `"${alias}" is an alias of "${ctx.trackAliases.get(alias)}" too, so it resolves to only one of them`,
          )
        } else {
          ctx.trackAliases.set(alias, trackId)
        }
      }
    }
  }
}

interface Ctx {
  assemblyNames: Set<string>
  // assemblies, not names: aliases put one assembly under several names, and
  // a loose track's implied assembly is only unambiguous when there is one
  assemblyCount: number
  seenTrackIds: Set<string>
  // ids tracks list in `aliases`, which a session may name too, to the trackId
  // listing each
  trackAliases: Map<string, string>
  // every id a session may legally name: the tracks plus each assembly's
  // ReferenceSequenceTrack, which lives on the assembly rather than in `tracks`
  sequenceTrackIds: Set<string>
  // a declared plugin registers slots and creates tracks at runtime, so what
  // only a plugin could supply is a warning here and an error without one
  declaresPlugins: boolean
  schema: SchemaValidator
  // per track node, since the defaults a track's displays take cost a schema
  // check per key and two passes read them
  reached: Map<Record<string, unknown>, ReachedDefaults[]>
}

// An assembly's `aliases` are usable wherever its name is.
function assemblyNamesOf(assembly: Record<string, unknown>) {
  return [assembly.name, ...listOf(assembly.aliases)].filter(
    (n): n is string => typeof n === 'string',
  )
}

function listOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function checkTrack(
  track: Record<string, unknown>,
  where: string,
  manifest: ConfigManifest,
  report: Report,
  ctx: Ctx,
) {
  const loose = isLooseTrackConfig(track)

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

  if (loose) {
    const file = fileNameOf(track.uri)
    const spec = matchFormat(file)?.spec
    if (!spec || !('adapterType' in spec)) {
      const message = `JBrowse infers no track from "${file}", so the track fails to load: give it an "adapter"`
      if (ctx.declaresPlugins) {
        report.warn(
          `${where}.uri`,
          `${message}, unless a plugin it declares guesses this extension`,
        )
      } else {
        report.error(`${where}.uri`, message)
      }
    }
  }

  checkPluggable(track, manifest.tracks, 'track', where, report, manifest)
  if (!loose) {
    checkPluggable(
      track.adapter,
      manifest.adapters,
      'adapter',
      `${where}.adapter`,
      report,
      manifest,
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
      manifest,
    )
  }
  if (Array.isArray(track.displays)) {
    const trackType = trackTypeOf(track)
    for (const [i, display] of track.displays.entries()) {
      const at = `${where}.displays[${i}]`
      if (!warnDroppedDisplay(display, trackType, manifest, at, report)) {
        checkPluggable(
          display,
          manifest.displays,
          'display',
          at,
          report,
          manifest,
        )
      }
    }
  }
  warnDisplayDefaults(track, manifest, where, report, ctx)
}

// Warns on a display entry whose type its track removes on load, and says
// whether it did, so the caller leaves the entry's settings unjudged
function warnDroppedDisplay(
  display: unknown,
  trackType: string | undefined,
  manifest: ConfigManifest,
  where: string,
  report: Report,
) {
  const type = isRecord(display) ? display.type : undefined
  const dropped =
    typeof type === 'string' &&
    trackType !== undefined &&
    !!manifest.tracks[trackType]?.droppedDisplays?.includes(type)
  if (dropped) {
    report.warn(
      `${where}.type`,
      `a ${trackType} drops its "${type}" display when the config loads, so the entry is never read. The config loads, and the entry can be deleted`,
    )
  }
  return dropped
}

// Each display a `displayDefaults` key reaches judges it as its own entry
// would, and a key two displays judge alike is said once.
function warnDisplayDefaults(
  track: Record<string, unknown>,
  manifest: ConfigManifest,
  where: string,
  report: Report,
  ctx: Ctx,
) {
  for (const { display, defaults } of reachedDefaults(track, manifest, ctx)) {
    const entry = manifest.displays[display]
    if (entry) {
      warnSlots(defaults, entry, `${where}.displayDefaults`, report, manifest)
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
  const where = `assemblies[${index}].sequence`
  for (const holder of ['sequence', 'refNameAliases', 'cytobands']) {
    const node = assembly[holder]
    if (isRecord(node) && isRecord(node.adapter)) {
      checkPluggable(
        node.adapter,
        manifest.adapters,
        'adapter',
        `assemblies[${index}].${holder}.adapter`,
        report,
        manifest,
      )
    }
  }
  if (isRecord(sequence) && Array.isArray(sequence.displays)) {
    for (const [i, display] of sequence.displays.entries()) {
      warnDroppedDisplay(
        display,
        'ReferenceSequenceTrack',
        manifest,
        `${where}.displays[${i}]`,
        report,
      )
    }
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
  if (isRecord(view)) {
    for (const [i, track] of listOf(view.tracks).entries()) {
      for (const [j, display] of (isRecord(track)
        ? listOf(track.displays)
        : []
      ).entries()) {
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
    for (const [i, sub] of listOf(view.views).entries()) {
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
  // A LinearSyntenyView's `tracks` is one array per level, so each level's
  // entries keep the level index in their path.
  const entries = listOf(view.tracks).flatMap((t, level) =>
    Array.isArray(t)
      ? t.map((entry: unknown, k) => ({ at: `[${level}][${k}]`, entry }))
      : [{ at: `[${level}]`, entry: t }],
  )
  for (const { at, entry } of entries) {
    // A built track snapshot names its config through `configuration` rather
    // than `trackId`, and is state MST restores rather than a reference to open.
    if (isRecord(entry) && !('trackId' in entry)) {
      continue
    }
    const trackId = isRecord(entry) ? entry.trackId : entry
    if (
      typeof trackId === 'string' &&
      !ctx.seenTrackIds.has(trackId) &&
      !ctx.trackAliases.has(trackId) &&
      !ctx.sequenceTrackIds.has(trackId)
    ) {
      const message = `trackId "${trackId}" is not defined in this config${didYouMean(trackId, [...ctx.seenTrackIds, ...ctx.sequenceTrackIds])}`
      if (ctx.declaresPlugins) {
        report.warn(
          `${where}.tracks${at}`,
          `${message} — a plugin it declares may create it`,
        )
      } else {
        report.error(`${where}.tracks${at}`, message)
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

  if (
    entry.builtTracksAt &&
    listOf(view.tracks).some(t => isRecord(t) && !('trackId' in t))
  ) {
    report.warn(
      `${where}.tracks`,
      `built track snapshots on the view's own "tracks" are a legacy layout the view moves to "${entry.builtTracksAt}" — the session loads, but write them there`,
    )
  }

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
  for (const [i, row] of listOf(view.views).entries()) {
    if (isRecord(row)) {
      if (typeof row.type === 'string') {
        checkSessionView(row, manifest, `${where}.views[${i}]`, report, ctx)
      } else {
        checkViewReferences(row, `${where}.views[${i}]`, report, ctx)
      }
    }
  }
}

// The written trackId wins at runtime, and the `{name, uri}` shorthand
// derives one only when none is written.
function sequenceTrackIdOf(assembly: Record<string, unknown>) {
  const declared = isRecord(assembly.sequence)
    ? assembly.sequence.trackId
    : undefined
  return typeof declared === 'string'
    ? [declared]
    : typeof assembly.name === 'string'
      ? [`${assembly.name}-ReferenceSequenceTrack`]
      : []
}

// A session's own tracks and assemblies are visible to its views and to no
// other session, so they land in a copy of the config's context.
function sessionContext(
  session: Record<string, unknown>,
  where: string,
  manifest: ConfigManifest,
  report: Report,
  ctx: Ctx,
) {
  const assemblies = [
    ...listOf(session.sessionAssemblies),
    ...listOf(session.temporaryAssemblies),
  ].filter(isRecord)
  const sessionCtx: Ctx = {
    ...ctx,
    assemblyNames: new Set([
      ...ctx.assemblyNames,
      ...assemblies.flatMap(a => assemblyNamesOf(a)),
    ]),
    seenTrackIds: new Set(ctx.seenTrackIds),
    trackAliases: new Map(ctx.trackAliases),
    sequenceTrackIds: new Set([
      ...ctx.sequenceTrackIds,
      ...assemblies.flatMap(a => sequenceTrackIdOf(a)),
    ]),
  }
  for (const [i, track] of listOf(session.sessionTracks).entries()) {
    if (isRecord(track)) {
      checkTrack(
        track,
        `${where}.sessionTracks[${i}]`,
        manifest,
        report,
        sessionCtx,
      )
    }
  }
  return sessionCtx
}

function checkSession(
  session: unknown,
  where: string,
  manifest: ConfigManifest,
  report: Report,
  configCtx: Ctx,
) {
  if (isRecord(session)) {
    const ctx = sessionContext(session, where, manifest, report, configCtx)
    const views = listOf(session.views)
    for (const [i, view] of views.entries()) {
      checkSessionViewTracks(view, manifest, `${where}.views[${i}]`, report)
    }
    for (const [i, view] of views.entries()) {
      if (isRecord(view)) {
        checkSessionView(view, manifest, `${where}.views[${i}]`, report, ctx)
      }
    }
  }
}

const MARK_DISPLAY = 'LinearMarkDisplay'
const SLOTS_POINTER = `/$defs/${MARK_DISPLAY}Slots/properties`

// The rule list reads a config snapshot, which is what a file is once the
// schema passes its keys and types and the manifest's lifts are applied. An
// entry the schema refuses is the schema's to report, and stands as a gap so
// its siblings keep their indices and their own reports. A list the file
// leaves unwritten is the slot's default entries, a display's default plot.
function declaredEntries<T>(
  { lifted, written: display, slots }: DisplayNode,
  slot: string,
  schema: SchemaValidator,
): (T | undefined)[] {
  const list = lifted[slot]
  const written = display[slot]
  if (!Array.isArray(written)) {
    return (slots.find(s => s.name === slot)?.defaultEntries ?? []) as T[]
  }
  return Array.isArray(list)
    ? list.map((entry, i) =>
        schema.hasDeclaredShape([written[i]], `${SLOTS_POINTER}/${slot}`)
          ? (entry as T)
          : undefined,
      )
    : []
}

function slotPath(slot: string) {
  return slot.replaceAll(/\.(\d+)(?=\.|$)/g, '[$1]')
}

// The display types that read a marks list: the mark display and every one
// built on it, which the manifest tells apart by the `marks` slot each lists.
function isMarkDisplayType(type: unknown, manifest: ConfigManifest) {
  return (
    typeof type === 'string' &&
    !!manifest.displays[type]?.slots.some(slot => slot.name === 'marks')
  )
}

// A mark display's own entry, whose marks may be its type's default plot, or
// a `displayDefaults` holding marks. A mark is a record with a `transform` of
// its own, so an untyped node counts only by its `marks`.
function holdsMarkRules(
  node: Record<string, unknown>,
  manifest: ConfigManifest,
) {
  return (
    isMarkDisplayType(node.type, manifest) ||
    (node.type === undefined && Array.isArray(node.marks))
  )
}

// What the marks of one display say together that it cannot draw as written:
// the rule list the display shows in its corner notice, copied from the plugin
// (`markRules/`). A single mark's `requires` is the schema's to report.
function checkMarkDisplay(
  node: DisplayNode,
  report: Report,
  schema: SchemaValidator,
) {
  const { lifted, slots, where } = node
  const { facet, encoding } = lifted
  const rowsWrites = slots.find(slot => slot.name === 'rows')?.writes
  const rows = isKeyedWrites(rowsWrites)
    ? keyedInForce(rowsWrites, lifted.rows)
    : lifted.rows
  const [axis] = slots.flatMap(slot =>
    valueAxesOf(lifted[slot.name], slot, slot.name),
  )
  for (const { level, rule, mark, slot, message } of markProblems({
    marks: declaredEntries<MarkSnapshot>(node, 'marks', schema),
    facet: isRecord(facet) ? facet : undefined,
    transform: declaredEntries<StepSnapshot>(node, 'transform', schema),
    rows: isRecord(rows) ? rows : undefined,
    rowAttributes:
      isRecord(rows) && Array.isArray(rows.groups) && rows.groups.length > 0
        ? ['group']
        : [],
    color:
      isRecord(encoding) && isRecord(encoding.color)
        ? encoding.color
        : undefined,
    axis: axis && {
      where: axis.where,
      fence: axis.fence,
      ends: scaleEndsOf(name => axis.ends[name], axis.fence),
    },
  })) {
    report.add({
      level,
      where: `${where}${mark === undefined ? '' : `.marks[${mark}]`}.${slotPath(slot)}`,
      message,
      rule,
    })
  }
}

// Each alignments filter and its rules copied from the plugins
// (`alignmentsFilterRules/`, `alignmentsLayerRules/`), checked on every
// display whose schema declares it: the reads' `filter` on a display of reads,
// which declares `pileup`, where other displays' `filter` tests other fields.
const ALIGNMENTS_FILTERS = [
  {
    path: ['filter'],
    declares: ['pileup'],
    rule: 'alignments-filter',
    problems: filterProblems,
  },
  {
    path: ['coverage', 'interbase', 'filter'],
    problems: interbaseEntryProblems,
  },
  {
    path: ['coverage', 'alleles', 'filter'],
    problems: alleleEntryProblems,
  },
  {
    path: ['pileup', 'bases', 'filter'],
    problems: basesEntryProblems,
  },
]

function declaresSlot(slots: readonly SlotEntry[], path: readonly string[]) {
  let entry: SlotEntry | undefined
  let level = slots
  for (const key of path) {
    entry = level.find(s => s.name === key)
    level = entry?.subSlots ?? []
  }
  return entry !== undefined
}

// A written filter list's entries as `predicatesOf` reads them, a bare string
// being `{ field, equal: true }`
function filterEntriesOf(list: unknown): FieldPredicate[] {
  return Array.isArray(list)
    ? list
        .map(entry =>
          typeof entry === 'string' ? { field: entry, equal: true } : entry,
        )
        .filter(
          (entry): entry is FieldPredicate =>
            isRecord(entry) && typeof entry.field === 'string',
        )
    : []
}

// What a display's corner notice says of its alignments filters: an entry on
// a field the filter has no reading of, a test the field does not take, or a
// floor past the field's range.
function checkAlignmentsFilters(
  { lifted, slots, where }: DisplayNode,
  report: Report,
) {
  for (const {
    path,
    declares = path,
    rule = 'alignments-layer-filter',
    problems,
  } of ALIGNMENTS_FILTERS) {
    if (declaresSlot(slots, declares)) {
      const written = path.reduce<unknown>(
        (at, key) => (isRecord(at) ? at[key] : undefined),
        lifted,
      )
      const at = `${where}.${path.join('.')}`
      for (const message of problems(filterEntriesOf(written))) {
        report.add({ level: 'warning', where: at, message, rule })
      }
    }
  }
}

// The row attributes a config states its rows carry: `group` where
// `rows.groups` derives one, the field `rows.color` colors them by, and the
// fields `rows.filter` tests
function statedRowAttributes(rows: unknown) {
  const color = isRecord(rows) && isRecord(rows.color) ? rows.color.field : ''
  return isRecord(rows)
    ? new Set([
        ...(Array.isArray(rows.groups) && rows.groups.length > 0
          ? ['group']
          : []),
        ...(typeof color === 'string' && color !== '' && color !== 'name'
          ? [color]
          : []),
        ...filterEntriesOf(rows.filter).map(p => p.field),
      ])
    : new Set<string>()
}

// What `RowPredicate` refuses that its schema cannot spell as `refuses`: a
// `jexl:` field, which no row has a record to compute over. Copied from
// `rowExpressionPointer`.
function rowExpressionProblem(field: string) {
  return `field '${field}' is an expression, and rows.filter computes none: it tests a row attribute, such as population`
}

// The row filter's checks the schema cannot make: a `rows.filter` entry on a
// `jexl:` expression, and a top-level `filter` entry testing a row attribute,
// on a display whose rows take a `rows.filter`: the top-level list tests
// records, so it points there.
function checkRowFilters(
  { lifted, slots, where }: DisplayNode,
  report: Report,
) {
  if (declaresSlot(slots, ['rows', 'filter'])) {
    const attributes = statedRowAttributes(lifted.rows)
    const rowFilter = isRecord(lifted.rows) ? lifted.rows.filter : undefined
    filterEntriesOf(rowFilter).forEach((entry, i) => {
      const at = `${where}.rows.filter[${i}].field`
      if (entry.field.startsWith('jexl:')) {
        report.add({
          level: 'error',
          where: at,
          message: rowExpressionProblem(entry.field),
          rule: 'row-filter',
        })
      }
    })
    const topLevel = declaresSlot(slots, ['filter']) ? lifted.filter : []
    filterEntriesOf(topLevel).forEach((entry, i) => {
      const at = `${where}.filter[${i}]`
      if (attributes.has(entry.field)) {
        report.add({
          level: 'warning',
          where: at,
          message: `"${entry.field}" is a row attribute, and the top-level filter tests records: rows.filter keeps rows by their attributes`,
          rule: 'row-filter',
        })
      }
    })
  }
}

// What `RowAnnotation` refuses of an entry written as a bare string, which the
// schema reads as a plain string: none and `name`. An object entry's are the
// schema's own `requires` and `refuses`. Copied from `ROW_ANNOTATION_NO_FIELD`
// and `ROW_ANNOTATION_ON_NAME`.
const ROW_ANNOTATION_REFUSALS: Record<string, string> = {
  '': "a rows.annotations entry needs a field, the row attribute its column colors by, as annotations: ['sex']",
  name: "field 'name' is the row itself, which its label already shows: a rows.annotations entry colors by an attribute of the row, such as sex",
}

function checkRowAnnotations(
  { written, slots, where }: DisplayNode,
  report: Report,
) {
  const { rows } = written
  const annotations =
    declaresSlot(slots, ['rows', 'annotations']) && isRecord(rows)
      ? rows.annotations
      : undefined
  if (Array.isArray(annotations)) {
    annotations.forEach((entry: unknown, i) => {
      const message =
        typeof entry === 'string' ? ROW_ANNOTATION_REFUSALS[entry] : undefined
      if (message) {
        report.add({
          level: 'error',
          where: `${where}.rows.annotations[${i}]`,
          message,
          rule: 'row-annotation',
        })
      }
    })
  }
}

// Each value axis's ends under `slot`, at any depth (`encoding.y.scale`,
// `coverage.encoding.y.scale`): the node whose schema names a `scaleFence`.
function valueAxesOf(
  written: unknown,
  slot: SlotEntry,
  where: string,
): { where: string; ends: Record<string, unknown>; fence: string }[] {
  if (!isRecord(written)) {
    return []
  }
  return slot.scaleFence
    ? [{ where, ends: written, fence: slot.scaleFence }]
    : (slot.subSlots ?? []).flatMap(sub =>
        valueAxesOf(written[sub.name], sub, `${where}.${sub.name}`),
      )
}

// A written channel's member by path, a bare string being its field. A
// member its schema does not declare reads as unset, as the display reads it.
function channelMember(
  written: unknown,
  slot: SlotEntry,
  path: readonly string[],
): unknown {
  let at: unknown = typeof written === 'string' ? { field: written } : written
  let entry: SlotEntry | undefined = slot
  for (const key of path) {
    entry = entry?.subSlots?.find(s => s.name === key)
    at = entry && isRecord(at) ? at[key] : undefined
  }
  return at
}

type ChannelProblem = Omit<ScaleProblem, 'rule'> & { rule: string }

// A VCF reader derives `svType` from ALT and INFO.SVTYPE and a BEDPE reader
// from ALT. Any other adapter's `svtype` is the file's own column, as in the
// gnomAD-SV bigBeds.
const PRESETS_ONLY_ADAPTERS_DERIVE: Record<string, string[]> = {
  svType: [
    'VcfAdapter',
    'VcfTabixAdapter',
    'SplitVcfTabixAdapter',
    'BedpeAdapter',
  ],
}

function namesOwnAttribute(field: string, near: string, adapterType?: string) {
  const derivers = PRESETS_ONLY_ADAPTERS_DERIVE[near]
  return (
    (field.length > near.length && field.endsWith(near)) ||
    field === near.charAt(0).toUpperCase() + near.slice(1) ||
    (adapterType !== undefined &&
      derivers !== undefined &&
      !derivers.includes(adapterType) &&
      field.toLowerCase() === near.toLowerCase())
  )
}

// Each color channel under `slot`, at any depth (`encoding.color`,
// `pileup.bases.encoding.color`), judged under its schema's fieldPresets.
function checkChannels(
  written: unknown,
  slot: SlotEntry,
  where: string,
  warn: (at: string, problem: ChannelProblem) => void,
  adapterType?: string,
) {
  if (slot.fieldPresets) {
    const color = withImpliedField(
      colorSlotsOf(path =>
        path.length === 1 && path[0] === 'field'
          ? (channelMember(written, slot, path) ?? slot.fieldDefault)
          : channelMember(written, slot, path),
      ),
      slot.impliedField,
    )
    for (const problem of colorProblems(color, slot.fieldPresets)) {
      warn(where, problem)
    }
    if (
      !color.field &&
      color.value === undefined &&
      color.scale?.type !== 'identity' &&
      (color.scale?.domain?.length ?? 0) > 0
    ) {
      warn(where, {
        rule: 'domain-no-field',
        slot: 'scale.domain',
        message:
          'domain orders the values of the field a color maps, and this color names no field, so nothing reads it; name the field its values come from, or for colors written in the file, set type to identity and list those colors',
      })
    }
    const field = channelMember(written, slot, ['field'])
    const presets = [
      ...Object.keys(slot.fieldPresets),
      ...Object.keys(UNIVERSAL_FIELD_PRESETS),
    ].filter(f => f !== '*')
    const near =
      typeof field === 'string' && !presets.includes(field)
        ? suggest(field, presets, 1)
        : undefined
    if (
      typeof field === 'string' &&
      near !== undefined &&
      !namesOwnAttribute(field, near, adapterType)
    ) {
      warn(where, {
        rule: 'field-near-preset',
        slot: 'field',
        message: `"${field}" is read as a feature attribute, not a preset field — did you mean "${near}"?`,
      })
    }
    return
  }
  if (isRecord(written)) {
    for (const sub of slot.subSlots ?? []) {
      checkChannels(
        written[sub.name],
        sub,
        `${where}.${sub.name}`,
        warn,
        adapterType,
      )
    }
  }
}

// What the display's color channels and its value scale say together that it
// cannot draw as written: its schema's fieldPresets stand in for the plugin
// code the CLI does not run, and every quantitative scale's ends answer to
// one rule.
function checkScaleSlots(
  { lifted, slots, where }: DisplayNode,
  report: Report,
  adapterType?: string,
) {
  const warn = (at: string, { rule, slot, message }: ChannelProblem) => {
    report.add({
      level: 'warning',
      where: `${at}.${slot}`,
      message,
      rule,
    })
  }
  for (const slot of slots) {
    const written = lifted[slot.name]
    if (written === undefined) {
      continue
    }
    checkChannels(written, slot, `${where}.${slot.name}`, warn, adapterType)
    for (const axis of valueAxesOf(written, slot, `${where}.${slot.name}`)) {
      for (const problem of scaleEndProblems(
        scaleEndsOf(name => axis.ends[name], axis.fence),
        { fence: axis.fence },
      )) {
        warn(axis.where, problem)
      }
    }
  }
}

// A marks list sits wherever a config takes a mark display's slots: a
// track's `displays` entry, its `displayDefaults`, a session's inline track
// entry. Only a mark display declares `marks`, so the walk is over the whole
// file, past a place where the schema refused the key: a session display node
// drops it.
// a track's type as written, or as a loose `{ trackId, uri }` entry's file
// name decides it, the way add-track does
function trackTypeOf(node: Record<string, unknown>) {
  if (typeof node.type === 'string') {
    return node.type
  }
  if (typeof node.uri !== 'string') {
    return undefined
  }
  const fileName = fileNameOf(node.uri)
  const format = matchFormat(
    fileName,
    typeof node.adapterType === 'string' ? node.adapterType : undefined,
  )
  return (
    format?.trackType ??
    (format && 'adapterType' in format.spec
      ? trackTypeForAdapter(format.spec.adapterType, fileName)
      : undefined)
  )
}

// The track's displays a `displayDefaults` reaches: the one its `type` names,
// or all of them.
function displaysTaking(
  trackType: string,
  defaults: Record<string, unknown>,
  manifest: ConfigManifest,
) {
  const { displayTypes } = displayDefaultsForTrackType(trackType, manifest)
  return defaults.type === undefined
    ? displayTypes
    : displayTypes.filter(display => display === defaults.type)
}

// The shorthand router hands a `displayDefaults` key only to the displays
// whose slot takes its value (`collectDisplayOverrides`), so a categorical
// color on a FeatureTrack never reaches its quantitative display's `score`
// presets. The same cut here, through each display's own schema branch.
function displayDefaultsReaching(
  display: string,
  defaults: Record<string, unknown>,
  schema: SchemaValidator,
) {
  return Object.fromEntries(
    Object.entries(defaults).filter(
      ([key, value]) =>
        key !== 'type' &&
        schema.schemaProblems(
          { type: display, [key]: value },
          `/$defs/${display}`,
        ).length === 0,
    ),
  )
}

interface ReachedDefaults {
  display: string
  defaults: Record<string, unknown>
}

function reachedDefaults(
  track: Record<string, unknown>,
  manifest: ConfigManifest,
  ctx: Ctx,
) {
  const trackType = trackTypeOf(track)
  const { displayDefaults } = track
  const reached =
    trackType && isRecord(displayDefaults)
      ? (ctx.reached.get(track) ??
        displaysTaking(trackType, displayDefaults, manifest).map(display => ({
          display,
          defaults: displayDefaultsReaching(
            display,
            displayDefaults,
            ctx.schema,
          ),
        })))
      : []
  if (reached.length > 0) {
    ctx.reached.set(track, reached)
  }
  return reached
}

// A display's settings, as written and as its schema holds them once loaded
interface DisplayNode {
  written: Record<string, unknown>
  lifted: Record<string, unknown>
  slots: SlotEntry[]
  where: string
}

function displayNodeOf(
  written: Record<string, unknown>,
  slots: SlotEntry[] | undefined,
  where: string,
) {
  const lifted = slots ? liftToSnapshot(written, slots) : undefined
  return slots && isRecord(lifted)
    ? { written, lifted, slots, where }
    : undefined
}

const DISPLAY_CHECKS = [
  checkScaleSlots,
  checkAlignmentsFilters,
  checkRowFilters,
  checkRowAnnotations,
]

function checkMarkDisplays(
  node: unknown,
  manifest: ConfigManifest,
  where: string,
  report: Report,
  ctx: Ctx,
  outerAdapterType?: string,
) {
  if (Array.isArray(node)) {
    for (const [i, item] of node.entries()) {
      checkMarkDisplays(
        item,
        manifest,
        `${where}[${i}]`,
        report,
        ctx,
        outerAdapterType,
      )
    }
  } else if (isRecord(node)) {
    const adapterType =
      isRecord(node.adapter) && typeof node.adapter.type === 'string'
        ? node.adapter.type
        : outerAdapterType
    const own = displayNodeOf(
      node,
      typeof node.type === 'string'
        ? manifest.displays[node.type]?.slots
        : undefined,
      where,
    )
    const reached = reachedDefaults(node, manifest, ctx).map(
      ({ display, defaults }) =>
        displayNodeOf(
          defaults,
          manifest.displays[display]?.slots,
          `${where}.displayDefaults`,
        ),
    )
    for (const display of [own, ...reached]) {
      if (display) {
        for (const check of DISPLAY_CHECKS) {
          check(display, report, adapterType)
        }
      }
    }
    if (
      holdsMarkRules(node, manifest) &&
      !report.problems.some(p => p.where === `${where}.marks`)
    ) {
      const marked =
        own ??
        displayNodeOf(node, manifest.displays[MARK_DISPLAY]?.slots, where)
      if (marked) {
        checkMarkDisplay(marked, report, ctx.schema)
      }
    }
    for (const [key, member] of Object.entries(node)) {
      checkMarkDisplays(
        member,
        manifest,
        where ? `${where}.${key}` : key,
        report,
        ctx,
        adapterType,
      )
    }
  }
}

const tableFields = ['category', 'kind', 'description', 'adapter']

// An entry of hierarchical.table.columns names a field the track table can
// show. The table skips one no track has, so a typo there only shows as a
// column that never appears; connection tracks are not in the file, so a
// metadata key only they carry is a warning, not an error.
function checkTableColumns(
  configuration: unknown,
  tracks: Record<string, unknown>[],
  report: Report,
) {
  const table =
    isRecord(configuration) && isRecord(configuration.hierarchical)
      ? configuration.hierarchical.table
      : undefined
  const columns = isRecord(table) ? listOf(table.columns) : []
  const metadataKeys = [
    ...new Set(
      tracks.flatMap(t =>
        isRecord(t.metadata) ? Object.keys(t.metadata) : [],
      ),
    ),
  ]
  for (const [i, entry] of columns.entries()) {
    const where = `configuration.hierarchical.table.columns[${i}]`
    if (typeof entry === 'string') {
      if (entry === 'name') {
        report.warn(where, '"name" is always the first column; leave it out')
      } else if (entry.startsWith('metadata.')) {
        const key = entry.slice('metadata.'.length)
        if (!metadataKeys.includes(key)) {
          report.warn(
            where,
            `no track in this config has metadata "${key}"${didYouMean(key, metadataKeys)}, so the table skips this column unless a connection's tracks carry it`,
          )
        }
      } else if (!tableFields.includes(entry)) {
        report.warn(
          where,
          `"${entry}" is not a track table field${didYouMean(entry, [...tableFields, ...metadataKeys.map(k => `metadata.${k}`)])}; use ${tableFields.join(', ')} or metadata.<key>`,
        )
      }
    }
  }
}

export function validateConfig(
  config: unknown,
  manifest: ConfigManifest = configManifest,
  schema: SchemaValidator = coreSchemaValidator,
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
      `config declares ${(config.plugins as unknown[]).length} plugin(s); the types they register are checked only where a plugin manifest (--plugin-manifest) lists them`,
    )
  }

  const { configuration } = config
  const pluginSlots =
    declaresPlugins && isRecord(configuration)
      ? Object.keys(configuration).filter(
          k => !schema.rootConfigurationSlots.has(k),
        )
      : []
  for (const key of pluginSlots) {
    report.warn(
      `configuration.${key}`,
      `core declares no "${key}" slot${didYouMeanKey(key, [...schema.rootConfigurationSlots])} — a plugin this config declares may`,
    )
  }
  // a near miss of a core key, or a `configuration` slot written a level too
  // high, stays the schema's error, so a plugin cannot hide `assemblys` or a
  // top-level `theme`
  const pluginRootKeys = declaresPlugins
    ? Object.keys(config).filter(
        k =>
          !schema.declaresConfigKey(k) &&
          !schema.rootConfigurationSlots.has(k) &&
          !didYouMeanKey(k, [...schema.configKeys]),
      )
    : []
  for (const key of pluginRootKeys) {
    report.warn(
      key,
      `core declares no top-level "${key}" — a plugin this config declares may, through its rootConfigurationSchema`,
    )
  }
  const coreKeys = Object.fromEntries(
    Object.entries(config).filter(([k]) => !pluginRootKeys.includes(k)),
  )
  for (const problem of schema.schemaProblems(
    pluginSlots.length && isRecord(configuration)
      ? {
          ...coreKeys,
          configuration: Object.fromEntries(
            Object.entries(configuration).filter(
              ([k]) => !pluginSlots.includes(k),
            ),
          ),
        }
      : coreKeys,
  )) {
    report.add(problem)
  }

  const assemblies = listOf(config.assemblies).filter(isRecord)
  if (assemblies.length === 0) {
    report.error('assemblies', 'no assemblies — a config needs at least one')
  }

  const ctx: Ctx = {
    assemblyNames: new Set(assemblies.flatMap(a => assemblyNamesOf(a))),
    assemblyCount: assemblies.length,
    seenTrackIds: new Set(),
    trackAliases: new Map(),
    declaresPlugins,
    schema,
    reached: new Map(),
    sequenceTrackIds: new Set(assemblies.flatMap(a => sequenceTrackIdOf(a))),
  }

  for (const [i, assembly] of assemblies.entries()) {
    checkAssembly(assembly, i, manifest, report)
  }

  const tracks = listOf(config.tracks).filter(isRecord)
  for (const [i, track] of tracks.entries()) {
    checkTrack(track, `tracks[${i}]`, manifest, report, ctx)
  }
  checkTrackAliases(tracks, report, ctx)
  checkTableColumns(configuration, tracks, report)

  const pluggableLists = [
    { key: 'connections', group: manifest.connections, label: 'connection' },
    {
      key: 'internetAccounts',
      group: manifest.internetAccounts,
      label: 'internet account',
    },
    {
      key: 'aggregateTextSearchAdapters',
      group: manifest.textSearchAdapters,
      label: 'text search adapter',
    },
  ]
  for (const { key, group, label } of pluggableLists) {
    const list = config[key]
    for (const [i, item] of listOf(list).entries()) {
      checkPluggable(item, group, label, `${key}[${i}]`, report, manifest)
    }
  }

  // Tracks are registered before the session is checked, so a session may
  // reference any track in the file regardless of declaration order.
  checkSession(config.defaultSession, 'defaultSession', manifest, report, ctx)
  const preConfigured = config.preConfiguredSessions
  for (const [i, session] of listOf(preConfigured).entries()) {
    checkSession(session, `preConfiguredSessions[${i}]`, manifest, report, ctx)
  }
  checkMarkDisplays(config, manifest, '', report, ctx)

  return report.result()
}
