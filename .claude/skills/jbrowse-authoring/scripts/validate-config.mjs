#!/usr/bin/env node
// Checks a JBrowse config.json (or a .jbrowse session file) against
// config-schema.json, which is generated from the live ConfigurationSchema
// objects by generate-schema.ts.
//
//   node validate-config.mjs path/to/config.json [--json]
//
// Exits 0 when there are no errors, 1 when there are, 2 if it could not read
// its inputs. Warnings never fail the run.
//
// Why this exists at all, given MST already type-checks a config on load: MST
// models IGNORE snapshot keys they do not declare. Write "bamLocatoin" and MST
// reports nothing, the track loads, and it renders empty — the config is wrong
// and every layer downstream is silent about it. Unknown-key detection is the
// check nothing else in the stack performs, and it is the mistake an agent
// authoring a config makes most.
//
// No dependencies on purpose. The generator needs the monorepo; this does not,
// so it can be copied next to whatever is doing the authoring.
import { readFileSync } from 'node:fs'
import path from 'node:path'

const SCHEMA_PATH = path.join(import.meta.dirname, 'config-schema.json')

// ---------------------------------------------------------------- suggestions

function editDistance(a, b) {
  // Two rolling rows rather than the full matrix; these are short identifiers
  // and this runs once per unknown key.
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = row
  }
  return prev[b.length]
}

// The nearest candidate, if it is near enough to be worth naming. The threshold
// scales with length so "uri" doesn't match every other three-letter slot while
// a long typo like "renderer.pileupHeght" still resolves.
function suggest(word, candidates) {
  const limit = Math.max(2, Math.floor(word.length / 3))
  let best
  let bestScore = Infinity
  for (const candidate of candidates) {
    const score = editDistance(word.toLowerCase(), candidate.toLowerCase())
    if (score < bestScore) {
      bestScore = score
      best = candidate
    }
  }
  return bestScore <= limit ? best : undefined
}

function didYouMean(word, candidates) {
  const hit = suggest(word, candidates)
  return hit ? ` — did you mean "${hit}"?` : ''
}

// ------------------------------------------------------------------ reporting

class Report {
  problems = []
  notes = []

  error(where, message) {
    this.problems.push({ level: 'error', where, message })
  }

  warn(where, message) {
    this.problems.push({ level: 'warning', where, message })
  }

  note(message) {
    this.notes.push(message)
  }

  get errorCount() {
    return this.problems.filter(p => p.level === 'error').length
  }

  get warningCount() {
    return this.problems.filter(p => p.level === 'warning').length
  }
}

// ------------------------------------------------------------------- checking

// Slot names a schema entry accepts as input: what it declares, plus the
// shorthand keys normalizeSnapshot expands (an adapter written with `uri` never
// mentions `bamLocation`, and both are correct).
function acceptedKeys(entry) {
  return [
    ...entry.slots.map(slot => slot.name),
    ...(entry.shorthandKeys ?? []),
  ]
}

function checkSlots(obj, entry, where, report) {
  const accepted = acceptedKeys(entry)
  const legacyKeys = entry.legacyKeys ?? []
  for (const key of Object.keys(obj)) {
    if (accepted.includes(key)) {
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
      `unknown slot "${key}"${didYouMean(key, accepted)} — JBrowse ignores keys it does not declare, so this setting silently does nothing`,
    )
  }
  // Recurse into sub-schemas the config actually filled in (adapter.index and
  // friends). A sub-schema the config omits is fine — it has its own defaults.
  for (const slot of entry.slots) {
    const value = obj[slot.name]
    if (slot.subSlots && value && typeof value === 'object' && !Array.isArray(value)) {
      checkSlots(value, { slots: slot.subSlots }, `${where}.${slot.name}`, report)
    }
  }
}

// Resolves a `type` against one of the schema groups, reporting whichever way
// it fails. Returns the entry, or undefined when there is nothing to check
// against.
//
// An unrecognized type is a WARNING, never an error, and the line is drawn
// there on purpose:
//
//   error   = JBrowse accepts the config and silently does the wrong thing
//   warning = JBrowse will complain by itself when the config loads
//
// An unknown type is loud — MST throws "Unknown track type" on load, so the
// author finds out. It is also frequently not wrong: a plugin can register
// types this manifest never saw, and a legacy name like LinearPileupDisplay is
// rewritten by a migration (migrateAlignmentsSnapshot.ts) and loads fine. An
// unknown *slot* has neither property, which is why that one is the error.
function resolveType(obj, group, groupLabel, where, report) {
  const typeName = obj.type
  if (typeof typeName !== 'string') {
    report.error(where, `missing "type" — expected one of the ${groupLabel} types`)
    return undefined
  }
  const entry =
    group[typeName] ??
    // An old type name a current type still answers to. baseTrackConfig
    // canonicalizes it before validation and sessionMigrations restores the
    // settings that made the old type distinct, so this is supported config —
    // check it against the type that absorbed it.
    Object.values(group).find(candidate => candidate.aliases?.includes(typeName))
  if (entry) {
    return entry
  }
  report.warn(
    where,
    `${groupLabel} type "${typeName}" is not registered by the core plugins${didYouMean(typeName, Object.keys(group))} — it may come from a plugin, or be a legacy name a migration rewrites`,
  )
  return undefined
}

function checkAdapter(adapter, schema, where, report) {
  if (!adapter || typeof adapter !== 'object') {
    report.error(where, 'missing "adapter"')
    return
  }
  const entry = resolveType(adapter, schema.adapters, 'adapter', `${where}.type`, report)
  if (entry) {
    checkSlots(adapter, entry, where, report)
  }
}

// `displayDefaults: {color: 'green'}` is a track-level shorthand
// (expandTrackConfigShorthand.ts) that routes each key to whichever of the
// track's display types declares it. So its keys check against the union of
// those displays' slots, not against the track's own.
function checkDisplayDefaults(defaults, trackEntry, schema, where, report) {
  if (!defaults || typeof defaults !== 'object' || Array.isArray(defaults)) {
    report.error(where, 'displayDefaults must be an object of display settings')
    return
  }
  const accepted = (trackEntry.displayTypes ?? []).flatMap(
    name => schema.displays[name]?.slots.map(slot => slot.name) ?? [],
  )
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

function checkTrack(track, index, schema, report, ctx) {
  const where = `tracks[${index}]`
  const entry = resolveType(track, schema.tracks, 'track', `${where}.type`, report)

  if (typeof track.trackId !== 'string' || !track.trackId) {
    report.error(`${where}.trackId`, 'missing "trackId"')
  } else if (ctx.seenTrackIds.has(track.trackId)) {
    report.error(
      `${where}.trackId`,
      `duplicate trackId "${track.trackId}" — a later track with the same id shadows the earlier one`,
    )
  } else {
    ctx.seenTrackIds.add(track.trackId)
  }

  const names = track.assemblyNames
  if (!Array.isArray(names) || names.length === 0) {
    report.error(`${where}.assemblyNames`, 'missing "assemblyNames"')
  } else {
    for (const name of names) {
      if (!ctx.assemblyNames.has(name)) {
        report.error(
          `${where}.assemblyNames`,
          `assembly "${name}" is not defined in this config${didYouMean(name, [...ctx.assemblyNames])}`,
        )
      }
    }
  }

  if (entry) {
    // displayDefaults is a shorthand no track schema declares, so it is
    // exempted from the track's own slot check and validated on its own terms.
    checkSlots(track, { ...entry, shorthandKeys: ['displayDefaults'] }, where, report)
    if (track.displayDefaults !== undefined) {
      checkDisplayDefaults(
        track.displayDefaults, entry, schema, `${where}.displayDefaults`, report,
      )
    }
  }
  checkAdapter(track.adapter, schema, `${where}.adapter`, report)

  if (Array.isArray(track.displays)) {
    track.displays.forEach((display, i) => {
      const displayWhere = `${where}.displays[${i}]`
      const displayEntry = resolveType(
        display, schema.displays, 'display', `${displayWhere}.type`, report,
      )
      if (displayEntry) {
        checkSlots(display, displayEntry, displayWhere, report)
      }
    })
  }
}

function checkAssembly(assembly, index, schema, report) {
  const where = `assemblies[${index}]`
  if (typeof assembly.name !== 'string' || !assembly.name) {
    report.error(`${where}.name`, 'missing assembly "name"')
  }
  const sequence = assembly.sequence
  if (!sequence || typeof sequence !== 'object') {
    report.error(`${where}.sequence`, 'missing "sequence" track')
    return
  }
  checkAdapter(sequence.adapter, schema, `${where}.sequence.adapter`, report)
}

// defaultSession views carry an `init` naming tracks and an assembly by id.
// Nothing validates those at load: a trackId that does not exist just silently
// fails to open, which looks like a rendering bug rather than a typo.
function checkSession(session, report, ctx) {
  const views = session?.views
  if (!Array.isArray(views)) {
    return
  }
  views.forEach((view, i) => {
    const init = view.init
    if (!init || typeof init !== 'object') {
      return
    }
    const where = `defaultSession.views[${i}].init`
    if (typeof init.assembly === 'string' && !ctx.assemblyNames.has(init.assembly)) {
      report.error(
        `${where}.assembly`,
        `assembly "${init.assembly}" is not defined in this config${didYouMean(init.assembly, [...ctx.assemblyNames])}`,
      )
    }
    if (Array.isArray(init.tracks)) {
      init.tracks.forEach((entry, j) => {
        const trackId = typeof entry === 'string' ? entry : entry?.trackId
        if (typeof trackId !== 'string') {
          report.error(`${where}.tracks[${j}]`, 'track entry has no trackId')
        } else if (!ctx.seenTrackIds.has(trackId)) {
          report.error(
            `${where}.tracks[${j}]`,
            `trackId "${trackId}" is not defined in this config${didYouMean(trackId, [...ctx.seenTrackIds])}`,
          )
        }
      })
    }
  })
}

export function validate(config, schema) {
  const report = new Report()
  if (Array.isArray(config.plugins) && config.plugins.length > 0) {
    report.note(
      `config declares ${config.plugins.length} plugin(s); the types and slots they register are not in this manifest and cannot be checked`,
    )
  }

  const assemblies = Array.isArray(config.assemblies)
    ? config.assemblies
    : config.assembly
      ? [config.assembly]
      : []
  if (assemblies.length === 0) {
    report.error('assemblies', 'no assemblies — a config needs at least one')
  }

  const ctx = {
    // An assembly's `aliases` are usable wherever its name is — a track can say
    // `assemblyNames: ['vvx']` against an assembly named volvox that lists vvx
    // as an alias, and that resolves fine. Leaving them out reports working
    // configs as broken.
    assemblyNames: new Set(
      assemblies.flatMap(a => [a?.name, ...(a?.aliases ?? [])]).filter(Boolean),
    ),
    seenTrackIds: new Set(),
  }

  assemblies.forEach((assembly, i) => {
    checkAssembly(assembly, i, schema, report)
  })

  const tracks = Array.isArray(config.tracks) ? config.tracks : []
  tracks.forEach((track, i) => {
    checkTrack(track, i, schema, report, ctx)
  })

  // Tracks are registered before the session is checked, so a session may
  // reference any track in the file regardless of declaration order.
  checkSession(config.defaultSession, report, ctx)

  return report
}

// ----------------------------------------------------------------------- main

function main(argv) {
  const asJson = argv.includes('--json')
  const file = argv.find(arg => !arg.startsWith('--'))
  if (!file) {
    console.error('usage: validate-config.mjs <config.json> [--json]')
    return 2
  }

  let schema
  let config
  try {
    schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'))
  } catch (error) {
    console.error(`could not read ${SCHEMA_PATH}: ${error.message}`)
    console.error('run generate-schema.ts from the jbrowse-components monorepo first')
    return 2
  }
  try {
    config = JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    console.error(`could not read ${file}: ${error.message}`)
    return 2
  }

  const report = validate(config, schema)

  if (asJson) {
    console.log(JSON.stringify({
      file,
      ok: report.errorCount === 0,
      errors: report.errorCount,
      warnings: report.warningCount,
      notes: report.notes,
      problems: report.problems,
    }, null, 2))
    return report.errorCount === 0 ? 0 : 1
  }

  for (const note of report.notes) {
    console.log(`note: ${note}`)
  }
  for (const { level, where, message } of report.problems) {
    console.log(`${level}: ${where}: ${message}`)
  }
  if (report.problems.length === 0) {
    console.log(`ok: ${file}`)
  } else {
    console.log(
      `\n${report.errorCount} error(s), ${report.warningCount} warning(s) in ${file}`,
    )
  }
  return report.errorCount === 0 ? 0 : 1
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)))
}
