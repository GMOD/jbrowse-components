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
  isLooseTrackConfig,
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
import { displayDefaultsForTrackType } from './displayDefaultKeys.ts'
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
  hasDeclaredShape,
  rootConfigurationSlots,
  schemaProblems,
} from './schemaValidate.ts'
import { didYouMean, suggest } from './suggest.ts'

import type { FieldPredicate } from './alignmentsFilterRules/filterRuleFacts.ts'
import type { ScaleProblem } from './markRules/colorScale.ts'
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

// What replaced a dropped legacy key, where there is something to say: a
// config written before v4 carries a `sequenceAdapter` on its BAM and CRAM
// adapters.
const DROPPED: Record<string, string> = {
  sequenceAdapter:
    'JBrowse takes the sequence from the assembly the track is displayed against. ',
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
        entry.droppedKeys?.includes(key)
          ? `"${key}" is a legacy key that is never read. ${DROPPED[key] ?? ''}The config loads, and the key can be deleted`
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
  warnDisplayDefaults(track, manifest, where, report)
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
) {
  const trackType = trackTypeOf(track)
  const defaults = track.displayDefaults
  if (!trackType || !isRecord(defaults)) {
    return
  }
  const found = new Report()
  for (const display of displaysTaking(trackType, defaults, manifest)) {
    const entry = manifest.displays[display]
    if (entry) {
      warnSlots(
        displayDefaultsReaching(display, defaults),
        entry,
        `${where}.displayDefaults`,
        found,
        manifest,
      )
    }
  }
  const said = new Set<string>()
  for (const problem of found.problems) {
    const key = `${problem.where}\n${problem.message}`
    if (!said.has(key)) {
      said.add(key)
      report.problems.push(problem)
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

  if (
    entry.builtTracksAt &&
    Array.isArray(view.tracks) &&
    view.tracks.some(t => isRecord(t) && !('trackId' in t))
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
// its siblings keep their indices and their own reports. A list the file
// leaves unwritten is the slot's default entries, a display's default plot.
function declaredEntries<T>(
  lifted: Record<string, unknown>,
  display: Record<string, unknown>,
  slot: string,
  slots: readonly SlotEntry[],
): (T | undefined)[] {
  const list = lifted[slot]
  const written = display[slot]
  if (!Array.isArray(written)) {
    return (slots.find(s => s.name === slot)?.defaultEntries ?? []) as T[]
  }
  return Array.isArray(list)
    ? list.map((entry, i) =>
        hasDeclaredShape([written[i]], `${SLOTS_POINTER}/${slot}`)
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
  display: Record<string, unknown>,
  manifest: ConfigManifest,
  where: string,
  report: Report,
) {
  const type = typeof display.type === 'string' ? display.type : MARK_DISPLAY
  const slots = manifest.displays[type]?.slots
  const lifted = liftToSnapshot(display, slots ?? [])
  if (!slots || !isRecord(lifted)) {
    return
  }
  const { facet, rows, rowGroups, encoding } = lifted
  const [axis] = slots.flatMap(slot =>
    valueAxesOf(lifted[slot.name], slot, slot.name),
  )
  for (const { level, rule, mark, slot, message } of markProblems({
    marks: declaredEntries<MarkSnapshot>(lifted, display, 'marks', slots),
    facet: isRecord(facet) ? facet : undefined,
    transform: declaredEntries<StepSnapshot>(
      lifted,
      display,
      'transform',
      slots,
    ),
    rows: isRecord(rows) ? rows : undefined,
    rowAttributes:
      Array.isArray(rowGroups) && rowGroups.length > 0 ? ['group'] : [],
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
    pushOnce(report, {
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
  display: Record<string, unknown>,
  type: string,
  manifest: ConfigManifest,
  where: string,
  report: Report,
) {
  const slots = manifest.displays[type]?.slots ?? []
  const lifted = liftToSnapshot(display, slots)
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
        if (
          !report.problems.some(p => p.where === at && p.message === message)
        ) {
          report.problems.push({
            level: 'warning',
            where: at,
            message,
            rule,
          })
        }
      }
    }
  }
}

// A problem the color and scale rules and the mark rule list both reach, such
// as the y axis's ends on a mark display, is reported once.
function pushOnce(report: Report, problem: Problem) {
  if (
    !report.problems.some(
      p => p.where === problem.where && p.rule === problem.rule,
    )
  ) {
    report.problems.push(problem)
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
    for (const problem of colorProblems(
      withImpliedField(
        colorSlotsOf(path =>
          path.length === 1 && path[0] === 'field'
            ? (channelMember(written, slot, path) ?? slot.fieldDefault)
            : channelMember(written, slot, path),
        ),
        slot.impliedField,
      ),
      slot.fieldPresets,
    )) {
      warn(where, problem)
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
  display: Record<string, unknown>,
  slots: SlotEntry[],
  where: string,
  report: Report,
  adapterType?: string,
) {
  const lifted = liftToSnapshot(display, slots)
  if (!isRecord(lifted)) {
    return
  }
  const warn = (at: string, { rule, slot, message }: ChannelProblem) => {
    pushOnce(report, {
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
) {
  return Object.fromEntries(
    Object.entries(defaults).filter(
      ([key, value]) =>
        key !== 'type' &&
        schemaProblems({ type: display, [key]: value }, `/$defs/${display}`)
          .length === 0,
    ),
  )
}

function checkMarkDisplays(
  node: unknown,
  manifest: ConfigManifest,
  where: string,
  report: Report,
  outerAdapterType?: string,
) {
  if (Array.isArray(node)) {
    for (const [i, item] of node.entries()) {
      checkMarkDisplays(
        item,
        manifest,
        `${where}[${i}]`,
        report,
        outerAdapterType,
      )
    }
  } else if (isRecord(node)) {
    const adapterType =
      isRecord(node.adapter) && typeof node.adapter.type === 'string'
        ? node.adapter.type
        : outerAdapterType
    const slots =
      typeof node.type === 'string'
        ? manifest.displays[node.type]?.slots
        : undefined
    if (slots) {
      checkScaleSlots(node, slots, where, report, adapterType)
    }
    if (typeof node.type === 'string') {
      checkAlignmentsFilters(node, node.type, manifest, where, report)
    }
    const trackType = trackTypeOf(node)
    if (trackType && isRecord(node.displayDefaults)) {
      for (const display of displaysTaking(
        trackType,
        node.displayDefaults,
        manifest,
      )) {
        const defaults = displayDefaultsReaching(display, node.displayDefaults)
        checkScaleSlots(
          defaults,
          manifest.displays[display]?.slots ?? [],
          `${where}.displayDefaults`,
          report,
          adapterType,
        )
        checkAlignmentsFilters(
          defaults,
          display,
          manifest,
          `${where}.displayDefaults`,
          report,
        )
      }
    }
    if (
      holdsMarkRules(node, manifest) &&
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
        adapterType,
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
      manifest,
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
      manifest,
    )
  }

  // Tracks are registered before the session is checked, so a session may
  // reference any track in the file regardless of declaration order.
  checkSession(config.defaultSession, manifest, report, ctx)
  checkMarkDisplays(config, manifest, '', report)

  return report.result()
}
