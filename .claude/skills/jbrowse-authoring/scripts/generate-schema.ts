// Emits config-schema.json: every registered adapter/track/display/connection
// type and the config slots it actually declares, read out of the live
// ConfigurationSchema objects rather than parsed out of source. Run it from the
// monorepo when schemas change:
//
//   node --experimental-strip-types .claude/skills/jbrowse-authoring/scripts/generate-schema.ts
//
// The validator that consumes the output has no dependencies at all — this
// script is the only piece that needs the repo. That split is deliberate: the
// heavy half runs once, here; the half an agent runs in a loop stays a plain
// node script it can drop anywhere.
//
// Why bundle instead of importing directly: the plugins reach .tsx files, which
// node's type stripping refuses, and @jbrowse/core only resolves from a package
// that depends on it. esbuild's stdin+resolveDir gives us both without writing a
// scratch entry file into someone else's package (this is a shared worktree).
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import esbuild from 'esbuild'

const REPO_ROOT = path.resolve(import.meta.dirname, '../../../..')
// jbrowse-web's corePlugins is the widest core set that is also plain web —
// desktop's adds Electron-only plugins that would drag the main process in.
const RESOLVE_DIR = path.join(REPO_ROOT, 'products/jbrowse-web')
const OUT = path.join(import.meta.dirname, 'config-schema.json')

// Runs inside the bundle, so it can reach the real PluginManager. Everything it
// needs to say has to come back as JSON.
const ENTRY = `
import PluginManager from '@jbrowse/core/PluginManager'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import corePlugins from './src/corePlugins.ts'

const pm = new PluginManager(corePlugins.map(P => new P()))
pm.createPluggableElements()
pm.configure()

// A ConfigurationSchema is wrapped in types.optional/late/etc; the model with
// the .properties we want is some number of unwraps down.
function modelOf(type) {
  let cur = type
  for (let i = 0; cur && !cur.properties && i < 12; i++) {
    cur = cur._subtype ?? cur.subType ?? cur.type
  }
  return cur
}

function slotsOf(type) {
  const model = modelOf(type)
  if (!model?.properties) {
    return undefined
  }
  return Object.entries(model.properties).map(([name, prop]) => ({
    name,
    // MST's own name for the slot type. Verbose for unions, but it is the real
    // accepted shape, and truncating it would invent a contract.
    type: prop?.name ?? 'unknown',
    // A sub-schema is an object slot with slots of its own (adapter.index,
    // track.displays[]); the validator recurses into these.
    subSlots: isSubSchema(prop) ? slotsOf(prop) : undefined,
  }))
}

function isSubSchema(prop) {
  const model = modelOf(prop)
  return Boolean(model?.properties && model.name?.endsWith('ConfigurationSchema'))
}

// normalizeSnapshot lets an adapter accept keys its schema never declares — the
// \`uri\` shorthand being the one everybody uses. Those are legal input, so the
// validator must not flag them. An arbitrary normalizeSnapshot can't be
// enumerated, so probe it instead. The candidate list is every key any
// normalizer in the repo reads:
//
//   grep -rhoE '\\bsnap\\.[a-zA-Z][a-zA-Z0-9]*' plugins/*/src packages/*/src | sort -u
//
// Keep the trailing [a-zA-Z0-9]* — without it the match stops at the first
// digit and bed1/bed2 read as a nonexistent "bed". Re-run when adding a
// normalizer that reads a new key, or this list quietly stops covering it and
// the validator starts crying wolf. A key listed here that no adapter uses
// costs nothing: the probe below just never reports it.
const SHORTHAND_PROBES = [
  'uri',
  'baseUri',
  'csi',
  'bed1',
  'bed2',
  'chromSizes',
  'localPath',
]

// Some shorthands only act as modifiers on another one — \`csi: true\` does
// nothing by itself and rewrites the index location when \`uri\` is also present.
// So each key is probed twice: alone, and alongside \`uri\`.
function shorthandKeysOf(adapterType) {
  const normalize = adapterType.normalizeSnapshot
  if (!normalize) {
    return []
  }
  // A normalizer spreads its input into its output, so an unrecognized key
  // still shows up there. Comparing raw outputs would therefore call every key
  // a shorthand. Drop the probe keys first and compare only what normalizing
  // *derived*.
  const run = (snap, omit) => {
    try {
      const out = normalize(snap)
      if (!out) {
        return null
      }
      const rest = { ...out }
      for (const key of omit) {
        delete rest[key]
      }
      return JSON.stringify(rest)
    } catch {
      return null
    }
  }
  const value = key => (key === 'csi' ? true : 'probe')
  const snapOf = keys => {
    const snap = { type: adapterType.name }
    for (const key of keys) {
      snap[key] = value(key)
    }
    return snap
  }
  const uriBaseline = run(snapOf(['uri']), ['uri'])

  const found = SHORTHAND_PROBES.filter(key => {
    const aloneOut = run(snapOf([key]), [key])
    // Understood on its own if normalizing derived anything beyond "type".
    if (aloneOut && Object.keys(JSON.parse(aloneOut)).length > 1) {
      return true
    }
    // Otherwise it may be a modifier — "csi: true" does nothing alone but
    // rewrites the index location when "uri" is present.
    const withUri = run(snapOf(['uri', key]), ['uri', key])
    return Boolean(uriBaseline && withUri && withUri !== uriBaseline)
  })

  // A few normalizers only fire when SEVERAL shorthands are present at once —
  // MCScanAnchorsAdapter wants uri AND bed1 AND bed2, so probing one key at a
  // time sees nothing. Retry the leftovers together, and if that fires, accept
  // all of them.
  //
  // That over-accepts: a key that came along for the ride is now allowed on
  // this adapter. Deliberate. The validator's job is a feedback loop for an
  // agent, so a missed typo (it moves on, and MST or the render catches it) is
  // a far cheaper error than crying wolf on a config that is actually fine —
  // which teaches the agent to ignore the tool.
  const rest = SHORTHAND_PROBES.filter(key => !found.includes(key))
  const together = run(snapOf(['uri', ...rest]), ['uri', ...rest])
  return together && together !== uriBaseline ? [...found, ...rest] : found
}

// Keys that no current schema declares but that some schema's own
// preProcessSnapshot still lifts into current slots. Written with one of these,
// a config loads correctly — so the validator must not call it an error — but
// it is stale and worth saying so.
//
// Whether a given schema honours a given key cannot be assumed: "renderer" is
// migrated by LinearBasicDisplay, LinearArcDisplay and ChordVariantDisplay, and
// silently dropped by LinearWiggleDisplay. So this is only the candidate list;
// legacyKeysOf below asks each schema directly.
//
// The value matters — a migration keyed on a shape ("renderer" being an object
// with lift-able props inside) does nothing for a probe of the wrong type.
const LEGACY_CANDIDATES = {
  renderer: { color1: 'probe', color: 'probe', strokeColor: 'probe' },
  renderers: { XYPlotRenderer: { type: 'XYPlotRenderer', color: 'probe' } },
  pileupDisplay: { type: 'LinearPileupDisplay' },
  snpCoverageDisplay: { type: 'LinearSNPCoverageDisplay' },
  defaultRendering: 'probe',
  autoHeight: true,
  showDescriptions: true,
  color1: 'probe',
  color2: 'probe',
  color3: 'probe',
  outline: 'probe',
}

// Asks a schema, by construction, which of the candidates above it actually
// consumes: build the config with and without the key and compare the resulting
// snapshots. Different means the key changed something — it was migrated.
// Identical means MST dropped it on the floor, which is the silent failure this
// whole tool exists to catch, so it stays an error.
//
// This is the same question the validator asks, answered by the real schema
// rather than by a list someone has to remember to update.
function legacyKeysOf(configSchema, declaredSlots) {
  const declared = new Set(declaredSlots.map(slot => slot.name))
  // Every schema has a required explicitIdentifier (displayId / trackId /
  // textSearchAdapterId / ...), and two things go wrong without pinning it:
  // create({}) throws outright, and a schema that DEFAULTS its identifier
  // generates a fresh random one per create — so baseline and probe differ
  // every time and every candidate reads as consumed. Pinning fixes both.
  const pinnedIds = Object.fromEntries(
    declaredSlots
      .filter(slot => /Id$/.test(slot.name))
      .map(slot => [slot.name, 'probe-id']),
  )
  let baseline
  try {
    baseline = JSON.stringify(getSnapshot(configSchema.create({ ...pinnedIds })))
  } catch {
    return []
  }
  return Object.entries(LEGACY_CANDIDATES)
    .filter(([key]) => !declared.has(key))
    .filter(([key, value]) => {
      try {
        const withKey = JSON.stringify(
          getSnapshot(configSchema.create({ ...pinnedIds, [key]: value })),
        )
        return withKey !== baseline
      } catch {
        // A throw means the key is rejected outright rather than ignored, which
        // is loud enough on its own — not a legacy key.
        return false
      }
    })
    .map(([key]) => key)
}

function collect(group, getType) {
  const record = pm.getElementTypeRecord(group)
  const out = {}
  for (const name of Object.keys(record.registeredTypes)) {
    let entry
    try {
      entry = getType(name)
    } catch {
      continue
    }
    if (!entry?.configSchema) {
      continue
    }
    const slots = slotsOf(entry.configSchema)
    if (!slots) {
      continue
    }
    const legacyKeys = legacyKeysOf(entry.configSchema, slots)
    out[name] = {
      slots,
      ...(legacyKeys.length ? { legacyKeys } : {}),
      ...(group === 'adapter'
        ? { shorthandKeys: shorthandKeysOf(entry) }
        : {}),
      // Old type names a DisplayType still answers to. baseTrackConfig
      // canonicalizes these before validation, and product-core's
      // sessionMigrations displayTypeMap additionally restores the settings
      // that made the old single-purpose display distinct — so a config using
      // one is fully supported, not stale, and must not be flagged.
      ...(entry.aliases?.length ? { aliases: entry.aliases } : {}),
      // Which displays a track offers. The validator needs these to check the
      // keys inside a track's displayDefaults shorthand, which route to
      // whichever of these display types declares each slot.
      ...(group === 'track'
        ? { displayTypes: (entry.displayTypes ?? []).map(d => d.name) }
        : {}),
    }
  }
  return out
}

console.log(JSON.stringify({
  adapters: collect('adapter', n => pm.getAdapterType(n)),
  tracks: collect('track', n => pm.getTrackType(n)),
  displays: collect('display', n => pm.getDisplayType(n)),
  textSearchAdapters: collect('text search adapter', n => pm.getTextSearchAdapterType(n)),
  connections: collect('connection', n => pm.getConnectionType(n)),
}))
`

const built = esbuild.buildSync({
  stdin: { contents: ENTRY, resolveDir: RESOLVE_DIR, loader: 'ts' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  logLevel: 'error',
  // Plugins import stylesheets for their React components; nothing we read
  // touches them, and node has no CSS loader.
  loader: { '.css': 'empty' },
})

const dir = mkdtempSync(path.join(tmpdir(), 'jbrowse-schema-'))
const bundlePath = path.join(dir, 'introspect.mjs')
writeFileSync(bundlePath, built.outputFiles[0].text)

// The bundle prints one JSON line. Import it and capture that, rather than
// spawning: a child process would just add a serialization hop.
const originalLog = console.log
let payload = ''
console.log = (...args: unknown[]) => {
  payload += args.join(' ')
}
await import(pathToFileURL(bundlePath).href)
console.log = originalLog

const schema = JSON.parse(payload) as Record<string, any>
writeFileSync(OUT, `${JSON.stringify(schema, null, 2)}\n`)

// The manifest is for the validator to read, not for an agent to hold in
// context — it is ~150KB. This index is the part an agent reads: every type
// name, one line each, and where to fetch the slot list for the one it picks.
const INDEX = path.join(import.meta.dirname, '../references/config-types.md')

// A type only gets a docs page if its configSchema carries a #config JSDoc tag,
// and a handful do not. Link the ones that exist and say so for the rest,
// rather than emitting a dead link an agent will waste a fetch on. A name
// appearing here as "(no docs page)" is a real gap in `pnpm gendocs` input.
const docsDir = path.join(REPO_ROOT, 'website/docs/config')
const docFiles = readdirSync(docsDir).filter(file => file.endsWith('.md'))
const documented = new Set(docFiles.map(file => file.replace(/\.md$/, '').toLowerCase()))

// Some displays are two registered types built from one shared schema
// (LDDisplay + LDTrackDisplay from SharedLDDisplay), and the #config tag — so
// the docs page — lives on the shared one. Saying "no docs page" for those is
// wrong: the slots are documented, just under another name. Find the Shared*
// page that names the type.
const sharedPageFor = new Map<string, string>()
for (const file of docFiles.filter(f => f.startsWith('Shared'))) {
  const body = readFileSync(path.join(docsDir, file), 'utf8')
  for (const group of ['tracks', 'displays', 'adapters'] as const) {
    for (const name of Object.keys(schema[group] ?? {})) {
      if (!documented.has(name.toLowerCase()) && body.includes(name)) {
        sharedPageFor.set(name, file.replace(/\.md$/, ''))
      }
    }
  }
}

const pageUrl = (slug: string) =>
  `https://jbrowse.org/jb2/docs/config/${slug.toLowerCase()}.md`
const link = (name: string) => {
  if (documented.has(name.toLowerCase())) {
    return `[${name}](${pageUrl(name)})`
  }
  const shared = sharedPageFor.get(name)
  return shared
    ? `${name} — slots documented under [${shared}](${pageUrl(shared)})`
    : `${name} (no docs page)`
}

const lines = [
  '<!-- Generated by scripts/generate-schema.ts. Do not edit by hand. -->',
  '',
  '# JBrowse config types',
  '',
  'Every type the core plugins register. For the slots a type accepts, fetch',
  'its page — the URL pattern is `https://jbrowse.org/jb2/docs/config/<lowercased type name>.md`.',
  '',
  'A type not listed here is not necessarily wrong: plugins register their own.',
  '',
  '## Track types',
  '',
  'A track pairs one adapter (where the data is) with one or more displays (how it is drawn).',
  '',
  ...Object.entries(schema.tracks).map(
    ([name, entry]: [string, any]) =>
      `- ${link(name)} — displays: ${(entry.displayTypes ?? []).join(', ') || 'none'}`,
  ),
  '',
  '## Display types',
  '',
  ...Object.keys(schema.displays).map(name => `- ${link(name)}`),
  '',
  '## Adapter types',
  '',
  'Adapters marked `uri` accept the `uri` shorthand (`{type, uri}`) instead of',
  'the explicit location slot, and derive the index location from it.',
  '',
  ...Object.entries(schema.adapters).map(([name, entry]: [string, any]) => {
    const shorthands = entry.shorthandKeys ?? []
    const suffix = shorthands.length ? ` — shorthands: ${shorthands.join(', ')}` : ''
    return `- ${link(name)}${suffix}`
  }),
  '',
  '## Text search adapters',
  '',
  ...Object.keys(schema.textSearchAdapters).map(name => `- ${link(name)}`),
  '',
  '## Connection types',
  '',
  ...Object.keys(schema.connections).map(name => `- ${link(name)}`),
  '',
]
writeFileSync(INDEX, `${lines.join('\n')}\n`)

const counts = Object.entries(schema)
  .filter(([, types]) => !Array.isArray(types))
  .map(([group, types]) => `${Object.keys(types as object).length} ${group}`)
  .join(', ')
console.log(`wrote ${path.relative(REPO_ROOT, OUT)}: ${counts}`)
