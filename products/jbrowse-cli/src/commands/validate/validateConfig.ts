// Checks a JBrowse config (or a saved session file) against the generated
// config-slot manifest.
//
// Why this exists at all, given MST type-checks a config on load: **MST models
// ignore snapshot keys they do not declare**. Write `bamLocatoin`, or a
// `renderers: {...}` block from an older config, and nothing anywhere reports
// it — the track loads, appears, and the setting silently does nothing. That is
// the check no other layer performs, and it is the mistake config authors
// (human or agent) make most.
//
// Pure: no filesystem, no process exit. The command wrapper owns both.

import { configManifest } from './configManifest.generated.ts'
import { displayDefaultKeys } from './displayDefaultKeys.ts'
import { didYouMean } from './suggest.ts'

import type {
  ConfigManifest,
  Problem,
  SlotEntry,
  TypeEntry,
  TypeGroup,
  ValidationResult,
  ViewEntry,
} from './types.ts'

// ------------------------------------------------------------------ reporting

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

// ------------------------------------------------------------------- checking

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Keys a schema entry accepts as input: what it declares, plus the shorthands
// normalizeSnapshot expands — an adapter written with `uri` never mentions
// `bamLocation`, and both forms are correct.
function acceptedKeys(entry: { slots: SlotEntry[]; shorthandKeys?: string[] }) {
  return [...entry.slots.map(s => s.name), ...(entry.shorthandKeys ?? [])]
}

// A key JBrowse fills in for itself, so writing one by hand is an anti-pattern
// whether or not the schema happens to declare a slot for it. Both halves get a
// message that says so, because the generic ones send the author looking for a
// typo in a key that is spelled correctly.
//
// `sequenceAdapter` is the standing case, and it is now uniform:
// `getFeatureAdapter` and `CoreGetRefNames` prime every feature adapter's
// `sequenceAdapterConfig` from the assembly the track is displayed against, and
// `getSequenceSubAdapter` is what every adapter that reads a sequence resolves
// through. So no track has to carry one — three grape/peach/volvox configs were
// copying their own assembly's FASTA urls into a GC track, and two hg002 tracks
// carried one on a `CramAdapter`, which declares no such slot at all.
//
// Two levels, and the split is this validator's own rule: an undeclared key does
// nothing where it is written (error), a declared one works and is simply the
// wrong way round (warning).
const SELF_SUPPLIED: Record<string, { undeclared: string; declared: string }> =
  {
    sequenceAdapter: {
      undeclared:
        'JBrowse takes the sequence from the assembly the track is displayed against, and this adapter declares no `sequenceAdapter` slot, so the one written here is never read — delete it',
      declared:
        '`sequenceAdapter` is set by hand. JBrowse takes the sequence from the assembly the track is displayed against, so this is only needed to read some OTHER sequence — and it pins the track to that source even when the assembly changes. Delete it unless that is what you meant',
    },
  }

function checkSlots(
  obj: Record<string, unknown>,
  entry: {
    slots: SlotEntry[]
    shorthandKeys?: string[]
    legacyKeys?: string[]
  },
  where: string,
  report: Report,
) {
  const accepted = acceptedKeys(entry)
  const legacyKeys = entry.legacyKeys ?? []
  for (const key of Object.keys(obj)) {
    if (accepted.includes(key)) {
      const selfSupplied = SELF_SUPPLIED[key]
      if (selfSupplied) {
        report.warn(`${where}.${key}`, selfSupplied.declared)
      }
      continue
    }
    // JSON has no comments, so people reach for a `_comment` key. MST drops it
    // like any other undeclared key, which is what the author wanted — calling
    // that "silently does nothing" is true and useless, and a validator that
    // cries wolf on a deliberate annotation is one an author learns to ignore.
    if (/^_+comment/i.test(key)) {
      continue
    }
    // A legacy key is consumed by the schema's own preProcessSnapshot and
    // lifted into current slots, so the config does load — but it is stale, and
    // whether every setting inside it survived the lift is worth a look.
    if (legacyKeys.includes(key)) {
      report.warn(
        `${where}.${key}`,
        `"${key}" is a legacy key that a migration rewrites into current slots — the config loads, but check the settings inside it landed`,
      )
      continue
    }
    report.error(
      `${where}.${key}`,
      SELF_SUPPLIED[key]?.undeclared ??
        `unknown slot "${key}"${didYouMean(key, accepted)} — JBrowse ignores keys it does not declare, so this setting silently does nothing`,
    )
  }
  // Recurse into sub-schemas the config actually filled in. One it omits is
  // fine: the sub-schema supplies its own defaults.
  for (const slot of entry.slots) {
    const value = obj[slot.name]
    if (slot.subSlots && isRecord(value)) {
      checkSlots(
        value,
        { slots: slot.subSlots },
        `${where}.${slot.name}`,
        report,
      )
    }
  }
}

// Resolves a `type` against one of the manifest's groups.
//
// An unrecognized type is a WARNING, never an error, and the line is drawn
// there deliberately:
//
//   error   = JBrowse accepts the config and silently does the wrong thing
//   warning = JBrowse will complain by itself when the config loads
//
// An unknown type is loud — MST throws "Unknown track type" on load, so the
// author finds out either way. It is also frequently not wrong: a plugin
// registers types this manifest never saw. An unknown *slot* has neither
// property, which is why that one is the error.
function resolveType<Entry extends { aliases?: string[] }>(
  obj: Record<string, unknown>,
  group: Record<string, Entry>,
  groupLabel: string,
  where: string,
  report: Report,
): (Entry & { canonicalName: string }) | undefined {
  const typeName = obj.type
  if (typeof typeName !== 'string') {
    report.error(
      where,
      `missing "type" — expected one of the ${groupLabel} types`,
    )
    return undefined
  }
  const canonical =
    typeName in group
      ? typeName
      : // An old type name a current type still answers to. baseTrackConfig
        // canonicalizes it before validation and sessionMigrations restores the
        // settings that made the old type distinct, so this is supported config
        // — check it against the type that absorbed it.
        Object.keys(group).find(name =>
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

function checkAdapter(
  adapter: unknown,
  manifest: ConfigManifest,
  where: string,
  report: Report,
) {
  if (!isRecord(adapter)) {
    report.error(where, 'missing "adapter"')
    return
  }
  const entry = resolveType(
    adapter,
    manifest.adapters,
    'adapter',
    `${where}.type`,
    report,
  )
  if (entry) {
    checkSlots(adapter, entry, where, report)
  }
}

// A pluggable sub-object written inline: resolve its type against `group`, then
// check its own slots. `connections`, `aggregateTextSearchAdapters` and a
// track's `textSearching.textSearchAdapter` are all this shape, and none of
// them was opened at all — a Trix path typo is a search that returns nothing,
// which is the class of mistake this command exists to catch.
function checkPluggable(
  obj: unknown,
  group: TypeGroup,
  groupLabel: string,
  where: string,
  report: Report,
) {
  if (!isRecord(obj)) {
    report.error(where, `${groupLabel} must be an object`)
    return
  }
  const entry = resolveType(obj, group, groupLabel, `${where}.type`, report)
  if (entry) {
    checkSlots(obj, entry, where, report)
  }
}

function checkDisplayDefaults(
  defaults: unknown,
  trackEntry: TypeEntry,
  manifest: ConfigManifest,
  where: string,
  report: Report,
) {
  if (!isRecord(defaults)) {
    report.error(where, 'displayDefaults must be an object of display settings')
    return
  }
  const accepted = displayDefaultKeys(trackEntry, manifest)
  if (accepted.length === 0) {
    return
  }
  for (const key of Object.keys(defaults)) {
    if (!accepted.includes(key)) {
      report.error(
        `${where}.${key}`,
        `no display of this track declares "${key}"${didYouMean(key, accepted)}`,
      )
    }
  }
}

interface Ctx {
  assemblyNames: Set<string>
  // assemblies, not names: aliases put one assembly under several names, and
  // a loose track's implied assembly is only unambiguous when there is one
  assemblyCount: number
  // trackIds declared in `tracks`, accumulated as they are checked — the set the
  // duplicate-trackId check reads, so nothing may be pre-seeded into it
  seenTrackIds: Set<string>
  // every id a session may legally name: the above plus each assembly's
  // ReferenceSequenceTrack, which is a real showable track that lives on the
  // assembly rather than in `tracks`
  sequenceTrackIds: Set<string>
}

function checkTrack(
  track: Record<string, unknown>,
  index: number,
  manifest: ConfigManifest,
  report: Report,
  ctx: Ctx,
) {
  const where = `tracks[${index}]`
  // The loose form: a data file and no adapter. JBrowse infers the track type
  // and adapter from the file's extension at load, so neither is required
  // here, and neither can be checked against the manifest without the format
  // plugins' guessers — the keys written beside `uri` still are.
  const loose = typeof track.uri === 'string' && !('adapter' in track)
  const entry =
    loose && track.type === undefined
      ? undefined
      : resolveType(track, manifest.tracks, 'track', `${where}.type`, report)

  const trackId = track.trackId
  if (typeof trackId !== 'string' || !trackId) {
    report.error(`${where}.trackId`, 'missing "trackId"')
  } else if (ctx.seenTrackIds.has(trackId)) {
    report.error(
      `${where}.trackId`,
      `duplicate trackId "${trackId}" — a later track with the same id shadows the earlier one`,
    )
  } else {
    ctx.seenTrackIds.add(trackId)
  }

  const names = track.assemblyNames
  if (!Array.isArray(names) || names.length === 0) {
    if (!loose || ctx.assemblyCount !== 1) {
      report.error(`${where}.assemblyNames`, 'missing "assemblyNames"')
    }
  } else {
    for (const name of names) {
      if (typeof name === 'string' && !ctx.assemblyNames.has(name)) {
        // The connection caveat leads and the spelling guess trails, because a
        // connection needn't be in this file to supply the assembly — the one
        // that supplies test_data/volvox's `volvox_del2` is added at runtime,
        // and `did you mean "volvox_del"?` called a working config a typo.
        report.error(
          `${where}.assemblyNames`,
          `assembly "${name}" is not defined in this config, and no connection here supplies one — though a connection added at runtime can${didYouMean(name, [...ctx.assemblyNames])}`,
        )
      }
    }
  }

  if (entry) {
    // displayDefaults is a shorthand no track schema declares, so it is
    // exempted from the track's own slot check and validated on its own terms.
    checkSlots(
      track,
      {
        ...entry,
        shorthandKeys: [
          ...(entry.shorthandKeys ?? []),
          'displayDefaults',
          ...(loose ? ['uri', 'index'] : []),
        ],
      },
      where,
      report,
    )
    if (track.displayDefaults !== undefined) {
      checkDisplayDefaults(
        track.displayDefaults,
        entry,
        manifest,
        `${where}.displayDefaults`,
        report,
      )
    }
  }
  if (!loose) {
    checkAdapter(track.adapter, manifest, `${where}.adapter`, report)
  }

  const textSearching = track.textSearching
  if (
    isRecord(textSearching) &&
    textSearching.textSearchAdapter !== undefined
  ) {
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
      if (!isRecord(display)) {
        continue
      }
      const displayWhere = `${where}.displays[${i}]`
      const displayEntry = resolveType(
        display,
        manifest.displays,
        'display',
        `${displayWhere}.type`,
        report,
      )
      if (displayEntry) {
        checkSlots(display, displayEntry, displayWhere, report)
      }
    }
  }
}

function checkAssembly(
  assembly: Record<string, unknown>,
  index: number,
  manifest: ConfigManifest,
  report: Report,
) {
  const where = `assemblies[${index}]`
  if (typeof assembly.name !== 'string' || !assembly.name) {
    report.error(`${where}.name`, 'missing assembly "name"')
  }
  // An assembly has three levels of shorthand, all filled in by
  // assemblyConfigSchema's preProcessSnapshot, and this used to reject every one
  // of them — including `{ name, uri }`, which the cookbook calls the smallest
  // possible config:
  //
  //   1. `{ name, uri }`                          -> sequence: { adapter: { uri } }
  //   2. `sequence: { adapter: { uri } }`         -> adapter type from the extension
  //   3. sequence with no type/trackId            -> ReferenceSequenceTrack, derived id
  //
  // Only (2) can't be checked here, and deliberately: the type is guessed
  // through the `Core-guessAdapterForLocation` extension point, and this command
  // loads no plugins on purpose. A `uri` is therefore taken as enough — saying
  // nothing about an adapter we can't name beats calling a working config broken.
  const sequence =
    assembly.sequence ??
    (typeof assembly.uri === 'string'
      ? { adapter: { uri: assembly.uri } }
      : undefined)
  if (!isRecord(sequence)) {
    report.error(
      `${where}.sequence`,
      'missing "sequence" track (or a `uri` naming the sequence file)',
    )
    return
  }
  if (isRecord(sequence.adapter) && !('type' in sequence.adapter)) {
    if (typeof sequence.adapter.uri !== 'string') {
      report.error(
        `${where}.sequence.adapter`,
        'adapter has neither a "type" nor a "uri" to infer one from',
      )
    }
    return
  }
  checkAdapter(sequence.adapter, manifest, `${where}.sequence.adapter`, report)
}

// A display node written inside a session — `views[].tracks[].displays[]` — is
// instantiated by the display's STATE MODEL, not by its config schema. Almost
// every track-menu setting is a config slot now, and a slot name here is dropped
// exactly like a misspelling: the session loads, the track appears, the setting
// does nothing. That is the same silent failure the slot checks above exist for,
// on the surface people hand-write most, and it is why a whole class of these
// sat unnoticed in this repo's own fixtures.
//
// The advice differs from the unknown-slot case, so the messages do too — a slot
// is real, it is just in the wrong place, and there are two right places for it.
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
  // A display type the manifest doesn't know (a plugin's) has already been
  // reported as a warning by resolveType; its props are unknowable here.
  if (!entry?.stateModelProps) {
    return
  }
  const props = entry.stateModelProps
  const slots = entry.slots.map(slot => slot.name)
  const migrated = new Set([
    ...(manifest.migratedDisplayKeys['*'] ?? []),
    ...(manifest.migratedDisplayKeys[entry.canonicalName] ?? []),
  ])
  for (const key of Object.keys(display)) {
    if (props.includes(key)) {
      continue
    }
    if (migrated.has(key)) {
      report.warn(
        `${where}.${key}`,
        `"${key}" is a legacy display-instance key that a session migration lifts onto the config slot replacing it — it still works, but writing the current slot is clearer`,
      )
    } else if (slots.includes(key)) {
      report.error(
        `${where}.${key}`,
        `"${key}" is a config slot, not a display property, so a session snapshot drops it and the setting silently does nothing — put it on the track's "displays" entry under "tracks", or in a "trackConfigDeltas" entry, instead`,
      )
    } else {
      report.error(
        `${where}.${key}`,
        `unknown display property "${key}"${didYouMean(key, [...props, ...slots])} — a session snapshot drops keys the display does not declare, so this setting silently does nothing`,
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

// A view node in a session — `defaultSession.views[]` — is instantiated by the
// view's STATE MODEL, and a view has no config schema at all, so every setting
// an author writes lands on that node: the properties MST restores, plus the
// launch keys a launcher resolves (`assembly`, `loc`, `tracks`). Those two
// together are the whole accepted set, which is what makes this check
// exhaustive rather than a guess — anything else is dropped exactly like a
// misspelling, and the view opens on its defaults with nothing said.
//
// The same trap checkSessionDisplay catches one level down, and the same three
// diagnoses: a real key in the wrong place, a stale spelling that still works,
// and a key nothing anywhere reads.
function checkSessionViewKeys(
  view: Record<string, unknown>,
  entry: ViewEntry & { canonicalName: string },
  manifest: ConfigManifest,
  where: string,
  report: Report,
) {
  const accepted = [
    ...entry.stateModelProps,
    ...entry.launchKeys,
    ...(entry.passThrough ?? []),
  ]
  for (const key of Object.keys(view)) {
    if (accepted.includes(key) || key === 'init') {
      continue
    }
    // Whichever other view types do read the key. `assembly` on a DotplotView is
    // not a misspelling and no suggestion reaches it, so naming the views that
    // take it is the only thing that tells the author what they wrote.
    const elsewhere = Object.entries(manifest.views)
      .filter(
        ([name, other]) =>
          name !== entry.canonicalName &&
          [...other.stateModelProps, ...other.launchKeys].includes(key),
      )
      .map(([name]) => name)
    report.error(
      `${where}.${key}`,
      elsewhere.length
        ? `"${key}" is a setting of ${elsewhere.join(', ')}, not of ${entry.canonicalName}${didYouMean(key, accepted)} — a session snapshot drops keys the view does not declare, so this setting silently does nothing`
        : `unknown view key "${key}"${didYouMean(key, accepted)} — a session snapshot drops keys the view does not declare, so this setting silently does nothing`,
    )
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
  // A LinearSyntenyView's `tracks` is one array PER LEVEL (`[[a], [b]]`) — the
  // multi-way form — so flatten one level before reading entries. Treating those
  // inner arrays as track entries reported every genome row of every synteny
  // demo as a track with no trackId.
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
    if (typeof trackId !== 'string') {
      report.error(`${where}.tracks[${j}]`, 'track entry has no trackId')
    } else if (
      !ctx.seenTrackIds.has(trackId) &&
      !ctx.sequenceTrackIds.has(trackId)
    ) {
      report.error(
        `${where}.tracks[${j}]`,
        `trackId "${trackId}" is not defined in this config${didYouMean(trackId, [...ctx.seenTrackIds, ...ctx.sequenceTrackIds])}`,
      )
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
  // A view type the manifest doesn't know (a plugin's) is already a warning from
  // resolveType, and its keys are unknowable here.
  if (!entry) {
    return
  }
  checkSessionViewKeys(view, entry, manifest, where, report)
  checkViewReferences(view, where, report, ctx)

  const init = view.init
  if (isRecord(init)) {
    report.warn(
      `${where}.init`,
      'nesting a view\'s settings under "init" is deprecated — write every setting directly on the view object',
    )
    checkSessionViewKeys(init, entry, manifest, `${where}.init`, report)
    checkViewReferences(init, `${where}.init`, report, ctx)
  }

  // A synteny or breakpoint row is a whole view snapshot of its own. Only a row
  // carrying a `type` can be checked: a row written as a recipe names no view
  // type, and which one it becomes is the parent launcher's business.
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

export function validateConfig(
  config: unknown,
  manifest: ConfigManifest = configManifest,
): ValidationResult {
  const report = new Report()
  if (!isRecord(config)) {
    report.error('', 'config is not a JSON object')
    return report.result()
  }
  if (Array.isArray(config.plugins) && config.plugins.length > 0) {
    report.note(
      `config declares ${config.plugins.length} plugin(s); the types and slots they register are not in the manifest and cannot be checked`,
    )
  }

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

  const connections = Array.isArray(config.connections)
    ? config.connections
    : []

  const ctx: Ctx = {
    // An assembly's `aliases` are usable wherever its name is — a track can say
    // `assemblyNames: ['vvx']` against an assembly named volvox that lists vvx
    // as an alias. Leaving them out reports working configs as broken.
    assemblyNames: new Set(
      assemblies
        .flatMap(a => [a.name, ...(Array.isArray(a.aliases) ? a.aliases : [])])
        .filter((n): n is string => typeof n === 'string'),
    ),
    assemblyCount: assemblies.length,
    seenTrackIds: new Set(),
    // Each assembly's ReferenceSequenceTrack is a real track a session may show
    // by id (`init.tracks: ['hg38-ReferenceSequenceTrack']`); it just lives on
    // the assembly rather than in `tracks`, and collecting only `tracks`
    // reported every such reference as undefined. Both the written trackId and
    // the one the `{name, uri}` shorthand derives, since a config using the
    // shorthand still gets the derived id at runtime.
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

  return report.result()
}
