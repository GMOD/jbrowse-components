// Emits the config-slot manifest `jbrowse validate` checks against: every
// registered adapter/track/display/connection type and the slots it actually
// declares, read out of the live ConfigurationSchema objects rather than parsed
// out of source. Rides `pnpm autogen`; run directly after editing a
// configSchema.ts:
//
//   node --experimental-strip-types scripts/generateConfigManifest.ts
//
// Emitted as a .ts module rather than a .json file so it compiles and bundles
// with the CLI like any other source — no JSON import attributes, no file to
// copy into dist, nothing to add to package.json `files`.
//
// The heavy half of validation lives here, run once. What ships in the CLI is
// the manifest plus a few hundred lines of plain checking, so `jbrowse validate`
// stays instant and pulls in no plugins.
//
// Why bundle instead of importing directly: the plugins reach .tsx files, which
// node's type stripping refuses, and @jbrowse/core only resolves from a package
// that depends on it. esbuild's stdin+resolveDir gives us both without writing a
// scratch entry file into someone else's package (this is a shared worktree).
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import esbuild from 'esbuild'

import {
  checkOrWriteAll,
  formatMarkdown,
} from '../website/scripts/check-utils.ts'

const REPO_ROOT = path.resolve(import.meta.dirname, '..')
// jbrowse-web's corePlugins is the widest core set that is also plain web —
// desktop's adds Electron-only plugins that would drag the main process in.
const RESOLVE_DIR = path.join(REPO_ROOT, 'products/jbrowse-web')
const OUT = path.join(
  REPO_ROOT,
  'products/jbrowse-cli/src/commands/validate/configManifest.generated.ts',
)
const INDEX = path.join(
  REPO_ROOT,
  '.claude/skills/jbrowse-authoring/references/config-types.md',
)

// Runs inside the bundle, so it can reach the real PluginManager. Everything it
// needs to say has to come back as JSON.
const ENTRY = `
import PluginManager from '@jbrowse/core/PluginManager'
import { MIGRATED_DISPLAY_INSTANCE_KEYS } from '@jbrowse/product-core'
import { getConfigurationSchemaMetadata } from '@jbrowse/core/configuration'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import corePlugins from './src/corePlugins.ts'

const pm = new PluginManager(corePlugins.map(P => new P()))
pm.createPluggableElements()
pm.configure()

// Every view and display registers its state model as a LOADER — nothing has
// built one yet — and \`stateModelProps\` below reads the built model's
// properties. Without this the manifest silently loses that key, and
// \`jbrowse validate\` stops being able to tell a config slot written on a
// session node from an MST prop, which is the one thing it reads it for.
await Promise.all([
  ...Object.keys(pm.getElementTypeRecord('display').registeredTypes).map(name =>
    pm.getDisplayType(name).loadStateModel(),
  ),
  ...Object.keys(pm.getElementTypeRecord('view').registeredTypes).map(name =>
    pm.getViewType(name).loadStateModel(),
  ),
])

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

// The MST properties of a type's STATE MODEL, which is a different question
// from its config slots and the one a saved session turns on: a session
// snapshot's display node is instantiated by the state model, so a config-slot
// name written there is dropped exactly like a misspelling. Collected for
// displays and for views — the two nodes a session actually carries settings on.
function stateModelPropsOf(stateModel) {
  const model = modelOf(stateModel)
  return model?.properties ? Object.keys(model.properties) : undefined
}

// A view has no config schema, so its accepted keys are its state model's
// properties plus the launch keys its registration publishes — \`assembly\`,
// \`loc\`, \`tracks\` and the rest, which a launcher resolves rather than MST. The
// two together are the COMPLETE set, which is what lets the validator call
// anything else an error rather than a guess.
function collectViews() {
  const out = {}
  for (const name of Object.keys(
    pm.getElementTypeRecord('view').registeredTypes,
  )) {
    let entry
    try {
      entry = pm.getViewType(name)
    } catch {
      continue
    }
    const stateModelProps = stateModelPropsOf(entry.stateModel)
    if (!stateModelProps) {
      continue
    }
    const registration = entry.launchKeys
    out[name] = {
      stateModelProps,
      // A view that registers none takes settings only as declared properties,
      // and the validator says so rather than assuming keys it cannot see.
      launchKeys: registration ? Object.keys(registration.keys).sort() : [],
      ...(registration?.passThrough?.length
        ? { passThrough: [...registration.passThrough].sort() }
        : {}),
      ...(entry.aliases?.length ? { aliases: entry.aliases } : {}),
    }
  }
  return out
}

// A snapshot normalizer lets an adapter accept keys its schema never declares —
// the \`uri\` shorthand being the one everybody uses. Those are legal input, so
// the validator must not flag them. An arbitrary normalizer can't be
// enumerated, so probe it instead, with the candidate keys SHORTHAND_PROBES
// supplies (derived from source by the outer script; see collectShorthandProbes).
const SHORTHAND_PROBES = __SHORTHAND_PROBES__

// An adapter's normalizer used to live in either of two places — \`normalizeSnapshot\`
// on the AdapterType, or the ConfigurationSchema's own \`preProcessSnapshot\` — and
// this had to try both, because an adapter wiring only the schema half
// (AllVsAllPAFAdapter, MCScanBlocksAdapter) otherwise reported NO shorthands and
// \`jbrowse validate\` called \`uri\` an unknown slot on the very config their
// #example shows. \`AdapterType.normalizeSnapshot\` now falls back to the schema's
// hook itself, so reading the one property covers both — and the localFiles path,
// which reads the same property, cannot disagree with what this manifest claims.
//
// Note it is the *metadata* the fallback reads, not a \`preProcessSnapshot()\`
// method on the type. Every schema is returned wrapped in \`types.stripDefault\`,
// whose own preprocessor merges the model defaults in, so walking the type chain
// and applying what it finds reports EVERY probe key as a shorthand on EVERY
// adapter — measured: 21 adapters claiming all seven, including ones with no
// preprocessor at all.

// Some shorthands only act as modifiers on another one — \`csi: true\` does
// nothing by itself and rewrites the index location when \`uri\` is also present.
// So each key is probed twice: alone, and alongside \`uri\`.
// AdapterType exposes a \`normalizeSnapshot\` getter that already falls back to
// the schema's own metadata; TextSearchAdapterType has no such getter and its
// schemas carry the preprocessor all the same — TrixTextSearchAdapter's is what
// makes \`{type, uri}\` the documented way to write one. Reading the metadata
// here covers both without giving the second type a getter it has no other use
// for.
function normalizerOf(entry) {
  return (
    entry.normalizeSnapshot ??
    getConfigurationSchemaMetadata(entry.configSchema)?.options
      .preProcessSnapshot
  )
}

function shorthandKeysOf(adapterType) {
  const normalize = normalizerOf(adapterType)
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
// Extra settings a candidate needs present before its effect is observable at
// all. \`showDescriptions\` alone migrates to showLabels 'auto' — the slot's own
// default, so stripDefault removes it again and the probe sees an unchanged
// snapshot. Only alongside the legacy \`showLabels: 'off'\` does it choose
// between 'none' and 'description'. Probed alone it read as unconsumed, and
// test_data/dog10k, which carries exactly that pair, was told its
// \`showDescriptions\` was an unknown slot rather than a legacy one.
const LEGACY_COMPANIONS = {
  showDescriptions: { showLabels: 'off' },
}

const LEGACY_CANDIDATES = {
  renderer: { color1: 'probe', color: 'probe', strokeColor: 'probe' },
  renderers: { XYPlotRenderer: { type: 'XYPlotRenderer', color: 'probe' } },
  pileupDisplay: { type: 'LinearPileupDisplay' },
  snpCoverageDisplay: { type: 'LinearSNPCoverageDisplay' },
  defaultRendering: 'probe',
  autoHeight: true,
  showDescriptions: false,
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
  const candidates = Object.entries(LEGACY_CANDIDATES).filter(
    ([key]) => !declared.has(key),
  )
  const snapshotOf = snap => {
    try {
      return JSON.stringify(
        getSnapshot(configSchema.create({ ...pinnedIds, ...snap })),
      )
    } catch {
      // A throw means the key is rejected outright rather than ignored, which
      // is loud enough on its own — not a legacy key.
      return undefined
    }
  }
  return candidates
    .filter(([key, value]) => {
      // Consumed on its own.
      const alone = snapshotOf({ [key]: value })
      if (alone !== undefined && alone !== baseline) {
        return true
      }
      // Otherwise it may only be observable ALONGSIDE another setting, the way
      // \`csi\` is on the shorthand probe above — except the companion here is a
      // declared slot at a legacy VALUE, not another legacy key, so no
      // combination of candidates finds it. LEGACY_COMPANIONS supplies it.
      const companions = LEGACY_COMPANIONS[key]
      if (!companions) {
        return false
      }
      const withKey = snapshotOf({ ...companions, [key]: value })
      const withoutKey = snapshotOf(companions)
      return (
        withKey !== undefined && withoutKey !== undefined && withKey !== withoutKey
      )
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
      ...(group === 'adapter' || group === 'text search adapter'
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
      // What a display node in a saved session may carry.
      ...(group === 'display'
        ? { stateModelProps: stateModelPropsOf(entry.stateModel) }
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
  views: collectViews(),
  // Legacy display-instance keys product-core's sessionMigrations still lifts
  // into the config, keyed by display type ('*' = any). Taken from the migration
  // itself rather than restated, so the two cannot disagree about what is stale
  // versus dead.
  migratedDisplayKeys: Object.fromEntries(
    Object.entries(MIGRATED_DISPLAY_INSTANCE_KEYS).map(([type, keys]) => [
      type,
      [...keys].sort(),
    ]),
  ),
}))
`

// Every key an ADAPTER's snapshot normalizer reads, which is the candidate set
// the probe inside the bundle tries against each adapter. Derived rather than
// hand-listed: the list used to be a literal with a comment telling the next
// person to re-run this grep, and it went stale exactly as the comment feared —
// `nhUri` (MafTabixAdapter's Newick sidecar, used by our own documented ce11
// example) was missing, so `jbrowse validate` called it an unknown slot.
//
// Scoped to adapter config schemas on two counts, because both matter:
//   - `configSchema*.ts` only. A `snap.x` elsewhere is some other kind of
//     snapshot processing, and the file glob is complete — every adapter
//     normalizer in the repo lives in one of these (the sole exception,
//     AdapterType.ts, is the base class that calls them).
//   - `#config <Name>Adapter` only. Track and display schemas run normalizers
//     too, for legacy-key migrations (`color`, `labels`, `renderer`, …), and
//     those keys are not adapter shorthands. Including them would widen the
//     "retry the leftovers together" fallback below, which accepts every
//     remaining candidate at once when it fires.
//
// Keep the trailing [a-zA-Z0-9]* in the pattern — without it the match stops at
// the first digit and bed1/bed2 read as a nonexistent "bed".
function collectShorthandProbes() {
  const files: string[] = []
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (!['node_modules', 'dist', 'esm', 'cjs', 'build'].includes(e.name)) {
          walk(full)
        }
      } else if (
        /^configSchema.*\.ts$/.test(e.name) &&
        !e.name.includes('.test.')
      ) {
        files.push(full)
      }
    }
  }
  for (const group of ['plugins', 'packages']) {
    walk(path.join(REPO_ROOT, group))
  }
  const keys = new Set<string>()
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    if (!/^\s*\*\s*#config\s+\w*Adapter\b/m.test(text)) {
      continue
    }
    for (const m of text.matchAll(/\bsnap\.([a-zA-Z][a-zA-Z0-9]*)/g)) {
      keys.add(m[1]!)
    }
  }
  // `type` is on every snapshot and is what the probe holds constant, so it is
  // never a shorthand; dropping it here keeps it out of the leftovers retry.
  keys.delete('type')
  if (!keys.has('uri')) {
    throw new Error(
      'collectShorthandProbes found no `uri` — the scan is not reaching the adapter schemas',
    )
  }
  // `uri` and its `baseUri` companion first, the rest alphabetical. Probe order
  // is the order each adapter's `shorthandKeys` comes out in, so a stable one
  // that leads with the common pair keeps the manifest diff to real changes
  // rather than churning every adapter whenever a key is added.
  const lead = ['uri', 'baseUri'].filter(k => keys.has(k))
  for (const k of lead) {
    keys.delete(k)
  }
  return [...lead, ...[...keys].sort()]
}

const built = esbuild.buildSync({
  stdin: {
    contents: ENTRY.replace(
      '__SHORTHAND_PROBES__',
      JSON.stringify(collectShorthandProbes()),
    ),
    resolveDir: RESOLVE_DIR,
    loader: 'ts',
  },
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
const bundle = built.outputFiles[0]
if (!bundle) {
  throw new Error('esbuild produced no output for the introspection bundle')
}
writeFileSync(bundlePath, bundle.text)

// The bundle prints one JSON line. Import it and capture that, rather than
// spawning: a child process would just add a serialization hop.
//
// The bundle is ~14MB (it carries every core plugin), so the temp dir has to go
// afterwards — this runs on every `pnpm autogen`, and leaving it behind put 21
// copies in /tmp over one afternoon of iterating. try/finally, so a bundle that
// throws on import doesn't leak one either.
const originalLog = console.log
let payload = ''
try {
  console.log = (...args: unknown[]) => {
    payload += args.join(' ')
  }
  await import(pathToFileURL(bundlePath).href)
} finally {
  console.log = originalLog
  rmSync(dir, { recursive: true, force: true })
}

const schema = JSON.parse(payload) as Record<string, any>
const manifest = [
  '// Generated by scripts/generateConfigManifest.ts — do not edit by hand.',
  '// Regenerate with `pnpm autogen` after changing any configSchema.ts.',
  "import type { ConfigManifest } from './types.ts'",
  '',
  `export const configManifest: ConfigManifest = ${JSON.stringify(schema, null, 2)}`,
  '',
].join('\n')

// The manifest is for the validator to read, not for an agent to hold in
// context — it is ~150KB. This index is the part an agent reads: every type
// name, one line each, and where to fetch the slot list for the one it picks.

// A type only gets a docs page if its configSchema carries a #config JSDoc tag,
// and a handful do not. Link the ones that exist and say so for the rest,
// rather than emitting a dead link an agent will waste a fetch on. A name
// appearing here as "(no docs page)" is a real gap in `pnpm gendocs` input.
const docsDir = path.join(REPO_ROOT, 'website/docs/config')
const docFiles = readdirSync(docsDir).filter(file => file.endsWith('.md'))
const documented = new Set(
  docFiles.map(file => file.replace(/\.md$/, '').toLowerCase()),
)

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
  '<!-- Generated by scripts/generateConfigManifest.ts. Do not edit by hand. -->',
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
  'The shortest track is `{ "trackId", "uri", "assemblyNames" }`, and in a',
  'config declaring one assembly the last of those goes too: the type and',
  "adapter come from the file's extension, and any key written beside `uri`",
  'overrides the inference.',
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
    const suffix = shorthands.length
      ? ` — shorthands: ${shorthands.join(', ')}`
      : ''
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
// The index is assembled one line per type, so its bullets run past the width
// `pnpm format` wraps markdown to. Both gates compare against the committed
// bytes — `autogen --check` against what this writes, `check-format` against
// what oxfmt writes — so it is formatted here, the same way, before either.
checkOrWriteAll(
  [
    { path: OUT, content: manifest, label: path.relative(REPO_ROOT, OUT) },
    {
      path: INDEX,
      content: formatMarkdown(`${lines.join('\n')}\n`, INDEX),
      label: path.relative(REPO_ROOT, INDEX),
    },
  ],
  'run `pnpm autogen`',
)

// Type groups only — `migratedDisplayKeys` is a lookup table, not a set of
// registered types, and counting its keys reads as "2 migrated display keys".
const TYPE_GROUPS = new Set([
  'adapters',
  'tracks',
  'displays',
  'textSearchAdapters',
  'connections',
  'views',
])
const counts = Object.entries(schema)
  .filter(([group]) => TYPE_GROUPS.has(group))
  .map(([group, types]) => `${Object.keys(types as object).length} ${group}`)
  .join(', ')
console.log(`${path.relative(REPO_ROOT, OUT)}: ${counts}`)
