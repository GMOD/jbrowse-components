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
  existsSync,
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
const SCHEMA_OUT = path.join(
  REPO_ROOT,
  'products/jbrowse-cli/src/commands/validate/configSchema.generated.ts',
)
const VERSION = (
  JSON.parse(
    readFileSync(
      path.join(REPO_ROOT, 'products/jbrowse-web/package.json'),
      'utf8',
    ),
  ) as { version: string }
).version
const SCHEMA_URL_PATH = `schema/v${VERSION.split('.')[0]}/config.json`
const SCHEMA_ID = `https://jbrowse.org/jb2/${SCHEMA_URL_PATH}`
const SCHEMA_SITE_OUT = path.join(REPO_ROOT, 'website/static', SCHEMA_URL_PATH)

// Runs inside the bundle, so it can reach the real PluginManager. Everything it
// needs to say has to come back as JSON.
const ENTRY = `
import PluginManager from '@jbrowse/core/PluginManager'
import { migratedDisplayInstanceKeys } from '@jbrowse/product-core'
import { LIFTED_DISPLAY_KEYS } from '../../packages/synteny-core/src/liftSyntenyViewSettings.ts'
import { JBrowseConfigF } from '@jbrowse/app-core'
import {
  getConfigurationSchemaMetadata,
  getConfigurationSchemaUnion,
  shorthandForm,
} from '@jbrowse/core/configuration'
import assemblyConfigSchemaFactory from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import { CSS_COLOR_NAMES } from '@jbrowse/core/util/color'
import { FileLocation } from '@jbrowse/core/util/types/mst'
import {
  getSnapshot,
  isArrayType,
  isFrozenType,
  isIdentifierType,
  isLiteralType,
  isMapType,
  isModelType,
  isReferenceType,
  isType,
} from '@jbrowse/mobx-state-tree'
import corePlugins from './src/corePlugins.ts'
import sessionModelFactory from './src/sessionModel/index.ts'
import {
  buildConfigJsonSchema,
  slotLifts,
} from '../../scripts/configJsonSchema.ts'

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
// the .properties we want is some number of unwraps down. An array of one
// sub-schema (a display's marks) unwraps through the array's element type,
// so its slots are the element's and the validator checks each entry; an array
// over a union (a track's displays) has no single model and stays opaque.
function modelOf(type) {
  let cur = type
  for (let i = 0; cur && !cur.properties && i < 12; i++) {
    cur = cur._subtype ?? cur._subType ?? cur.subType ?? cur.type
  }
  return cur
}

function slotsOf(type) {
  const model = modelOf(type)
  if (!model?.properties) {
    return undefined
  }
  const meta = getConfigurationSchemaMetadata(model)
  return Object.entries(model.properties).map(([name, prop]) => {
    const sub = isSubSchema(prop)
    const lifts = meta ? slotLifts(meta, name) : {}
    const subOptions = sub
      ? getConfigurationSchemaMetadata(modelOf(prop))?.options
      : undefined
    return {
      name,
      // MST's own name for the slot type. Verbose for unions, but it is the real
      // accepted shape, and truncating it would invent a contract.
      type: prop?.name ?? 'unknown',
      // A sub-schema is an object slot with slots of its own (adapter.index,
      // track.displays[]); the validator recurses into these.
      subSlots: sub ? slotsOf(prop) : undefined,
      // What the schema lifts on the way in, which the validator applies to a
      // file before its rules read it: a bare string into a sub-schema's
      // shorthand slot or into a list of one, and numbers carried as strings.
      shorthand: subOptions?.shorthand,
      // a colour object's defaults by field, which the validator's colour
      // rules read the object with
      fieldPresets: subOptions?.fieldPresets,
      liftsString: lifts.string || undefined,
      liftsNumbers: lifts.numbers || undefined,
      liftsUri: lifts.uri || undefined,
    }
  })
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
// (MultiGenomePAFAdapter, MCScanBlocksAdapter) otherwise reported NO shorthands and
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

  // One key at a time is the whole probe, so a normalizer has to expand each of
  // its keys independently to be seen. A fallback retried the leftovers together
  // for the two all-or-nothing MCScan normalizers and accepted every remaining
  // candidate when that fired, which put chromSizes, htsgetBase and nhUri in
  // those adapters' documented shorthand lists. Both expand per key now, the
  // fallback fired for nothing, and it is gone: a normalizer needing several keys
  // at once is a normalizer to narrow, not a case to accept broadly.
  return found
}

// Keys that no current schema declares but that some schema's own
// preProcessSnapshot still lifts into current slots. Written with one of these,
// a config loads correctly — so the validator must not call it an error — but
// it is stale and worth saying so.
//
// Whether a given schema honours a given key cannot be assumed: "renderer" is
// migrated by LinearBasicDisplay and ChordVariantDisplay, and
// silently dropped by LinearWiggleDisplay. So this is only the candidate list;
// legacyKeysOf below asks each schema directly.
//
// The value matters — a migration keyed on a shape ("renderer" being an object
// with lift-able props inside) does nothing for a probe of the wrong type, and
// one landing in a color slot has to be a color, or the slot refuses it and
// the key reads as dropped.
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

const PROBE_COLOR = '#123456'

const LEGACY_CANDIDATES = {
  renderer: {
    color1: PROBE_COLOR,
    color: PROBE_COLOR,
    strokeColor: PROBE_COLOR,
  },
  renderers: {
    XYPlotRenderer: { type: 'XYPlotRenderer', color: PROBE_COLOR },
  },
  pileupDisplay: { type: 'LinearPileupDisplay' },
  snpCoverageDisplay: { type: 'LinearSNPCoverageDisplay' },
  defaultRendering: 'probe',
  autoHeight: true,
  showDescriptions: false,
  color1: PROBE_COLOR,
  color2: PROBE_COLOR,
  color3: PROBE_COLOR,
  outline: PROBE_COLOR,
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
  // A schema that DECLARES its retired spellings needs no probe for them: the
  // map is the answer, and a probe could not find a key whose lift the
  // candidate list never thought to try. A string-valued entry is a setting
  // that is gone rather than renamed, so it stays a key the validator refuses.
  const declaredRetired = Object.entries(
    getConfigurationSchemaMetadata(configSchema)?.options.retired ?? {},
  )
    .filter(([key, value]) => typeof value === 'function' && !declared.has(key))
    .map(([key]) => key)
  // Most schemas have a required explicitIdentifier (displayId / trackId /
  // ...), and two things go wrong without pinning it:
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
    ([key]) => !declared.has(key) && !declaredRetired.includes(key),
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
  const probed = candidates
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
  return [...declaredRetired, ...probed]
}

// Values an enum slot no longer spells but that the schema's preProcessSnapshot
// still rewrites — \`showLabels: false\` from before the unified enum. Asked of
// each schema by construction, like the keys above: a candidate the migration
// consumes builds and comes out as something else, one it does not throws.
const LEGACY_VALUE_CANDIDATES = [
  true,
  false,
  'on',
  'off',
  'reducedRepresentation',
  'collapse',
]

function legacyValuesOf(configSchema, declaredSlots) {
  const definition = getConfigurationSchemaMetadata(configSchema)?.definition
  if (!definition) {
    return {}
  }
  const pinnedIds = Object.fromEntries(
    declaredSlots
      .filter(slot => /Id$/.test(slot.name))
      .map(slot => [slot.name, 'probe-id']),
  )
  const out = {}
  for (const [slot, entry] of Object.entries(definition)) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      !/^(maybe)?[sS]tringEnum$/.test(String(entry.type))
    ) {
      continue
    }
    const accepted = LEGACY_VALUE_CANDIDATES.filter(value => {
      if (entry.model?.is(value)) {
        return false
      }
      try {
        const snap = getSnapshot(
          configSchema.create({ ...pinnedIds, [slot]: value }),
        )
        return snap[slot] !== value
      } catch {
        return false
      }
    })
    if (accepted.length) {
      out[slot] = accepted
    }
  }
  return out
}

// The slot values a display's retired types spelt, which their \`migrate\`
// rewrites and the schema probe above cannot reach. A value the slot still
// accepts is a current spelling, so it is left out.
function retiredTypeValuesOf(entry) {
  const definition =
    getConfigurationSchemaMetadata(entry.configSchema)?.definition ?? {}
  const out = {}
  for (const [slot, values] of (entry.retiredTypes ?? []).flatMap(r =>
    Object.entries(r.values ?? {}),
  )) {
    const model = definition[slot]?.model
    const legacy = values.filter(value => model && !model.is(value))
    if (legacy.length) {
      out[slot] = [...new Set([...(out[slot] ?? []), ...legacy])]
    }
  }
  return out
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
    const probed = legacyValuesOf(entry.configSchema, slots)
    const retiredValues = group === 'display' ? retiredTypeValuesOf(entry) : {}
    const legacyValues = Object.fromEntries(
      [...new Set([...Object.keys(probed), ...Object.keys(retiredValues)])].map(
        slot => [
          slot,
          [...new Set([...(probed[slot] ?? []), ...(retiredValues[slot] ?? [])])],
        ],
      ),
    )
    out[name] = {
      slots,
      ...(legacyKeys.length ? { legacyKeys } : {}),
      ...(Object.keys(legacyValues).length ? { legacyValues } : {}),
      ...(group === 'adapter' || group === 'text search adapter'
        ? { shorthandKeys: shorthandKeysOf(entry) }
        : {}),
      // Old type names a DisplayType still answers to, from its
      // retiredTypes. The track config loads one as its successor, with the
      // settings that made the old display distinct, so a config using one is
      // fully supported, not stale, and must not be flagged.
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

const manifest = {
  adapters: collect('adapter', n => pm.getAdapterType(n)),
  tracks: collect('track', n => pm.getTrackType(n)),
  displays: collect('display', n => pm.getDisplayType(n)),
  textSearchAdapters: collect('text search adapter', n => pm.getTextSearchAdapterType(n)),
  connections: collect('connection', n => pm.getConnectionType(n)),
  internetAccounts: collect('internet account', n => pm.getInternetAccountType(n)),
  views: collectViews(),
  // Legacy display-instance keys the session migration still lifts into the
  // config, keyed by display type ('*' = any), read off the DisplayTypes the
  // migration reads, so the two cannot disagree about what is stale versus dead.
  // The synteny displays' v4.3.0 colour, opacity and length filter move onto
  // the view instead, read off the view's own lift.
  migratedDisplayKeys: (() => {
    const migrated = migratedDisplayInstanceKeys(pm)
    return Object.fromEntries(
      [
        ...new Set([
          ...Object.keys(migrated),
          ...Object.keys(LIFTED_DISPLAY_KEYS),
        ]),
      ].map(type => [
        type,
        [...(migrated[type] ?? []), ...(LIFTED_DISPLAY_KEYS[type] ?? [])].sort(),
      ]),
    )
  })(),
}

// Every registered element of a group whose type resolves, with the built
// state model where one exists (loadStateModel ran above).
function elements(group, getType) {
  return Object.keys(pm.getElementTypeRecord(group).registeredTypes).flatMap(
    name => {
      try {
        return [getType(name)]
      } catch {
        return []
      }
    },
  )
}

const assemblyConfigSchema = assemblyConfigSchemaFactory(pm)
const configModel = JBrowseConfigF({ pluginManager: pm, assemblyConfigSchema })
const schema = buildConfigJsonSchema({
  schemaId: __SCHEMA_ID__,
  version: __VERSION__,
  elements: {
    adapters: elements('adapter', n => pm.getAdapterType(n)),
    tracks: elements('track', n => pm.getTrackType(n)),
    displays: elements('display', n => pm.getDisplayType(n)),
    textSearchAdapters: elements('text search adapter', n =>
      pm.getTextSearchAdapterType(n),
    ),
    connections: elements('connection', n => pm.getConnectionType(n)),
    internetAccounts: elements('internet account', n =>
      pm.getInternetAccountType(n),
    ),
    views: elements('view', n => pm.getViewType(n)),
  },
  metadataOf: getConfigurationSchemaMetadata,
  unionOf: getConfigurationSchemaUnion,
  shorthandFormOf: shorthandForm,
  cssColorNames: CSS_COLOR_NAMES,
  isType,
  isArrayType,
  isMapType,
  isModelType,
  isLiteralType,
  isFrozenType,
  isIdentifierType,
  isReferenceType,
  fileLocation: FileLocation,
  assemblySchema: assemblyConfigSchema,
  rootConfigSchema: configModel.properties.configuration,
  configModel,
  sessionModel: sessionModelFactory({ pluginManager: pm, assemblyConfigSchema }),
  migratedDisplayKeys: manifest.migratedDisplayKeys,
  legacyKeysOf: (group, name) => groupOf(group)[name]?.legacyKeys ?? [],
  legacyValuesOf: (group, name) => groupOf(group)[name]?.legacyValues ?? {},
  shorthandKeysOf: (group, name) => groupOf(group)[name]?.shorthandKeys ?? [],
})

function groupOf(group) {
  return {
    adapter: manifest.adapters,
    track: manifest.tracks,
    display: manifest.displays,
    'text search adapter': manifest.textSearchAdapters,
    connection: manifest.connections,
    'internet account': manifest.internetAccounts,
  }[group]
}

console.log(JSON.stringify({ manifest, schema }))
`

// Every key an ADAPTER's snapshot normalizer reads, which is the candidate set
// the probe inside the bundle tries against each adapter. Derived rather than
// hand-listed: the list used to be a literal with a comment telling the next
// person to re-run this grep, and it went stale exactly as the comment feared —
// `nhUri` (MafTabixAdapter's Newick sidecar, used by our own documented ce11
// example) was missing, so `jbrowse validate` called it an unknown slot.
//
// Scoped to what an ADAPTER config schema can reach, on two counts:
//   - `configSchema*.ts` plus the files it imports: its own `util/` helper (where
//     the maf adapters share their normalizer) and, through core's configuration
//     barrel, the shared shorthand it names. `csi` is read only in
//     `tabixShorthand.ts`, so only the barrel hop keeps `csi` a candidate at all
//     once BAM's index derivation moved there.
//   - `#config <Name>Adapter` only. Track, display and assembly schemas run
//     normalizers too, for legacy-key migrations (`color`, `labels`, `renderer`,
//     …) and their own shorthands (`trackId`, `sequence`), and those are not
//     adapter shorthands. Reachability excludes them: no adapter schema imports
//     `expandTrackConfigShorthand` or `expandAssemblyConfigShorthand`.
//
// Keep the trailing [a-zA-Z0-9]* in the patterns — without it the match stops at
// the first digit and bed1/bed2 read as a nonexistent "bed".
//
// Both spellings of a read, because a normalizer may use either and the
// difference is undetectable downstream: destructuring `{ uri, bed1, bed2 }`
// dropped bed1/bed2 from this list and had `jbrowse validate` call them unknown
// slots on the config the MCScan tutorial hands the reader.
function keysRead(source: string) {
  const keys: string[] = []
  for (const m of source.matchAll(/\bsnap\.([a-zA-Z][a-zA-Z0-9]*)/g)) {
    keys.push(m[1]!)
  }
  for (const m of source.matchAll(/\{([^{}]*)\}\s*=\s*snap\b/g)) {
    for (const part of m[1]!.split(',')) {
      // `a: b` renames and `...rest` gathers, so the snapshot's own key is the
      // part before any colon
      const name = part.split(':')[0]!.trim()
      if (/^[a-zA-Z][a-zA-Z0-9]*$/.test(name)) {
        keys.push(name)
      }
    }
  }
  return keys
}

const CORE_CONFIGURATION = path.join(
  REPO_ROOT,
  'packages/core/src/configuration/index.ts',
)

/**
 * The sources an adapter config schema's normalizer can be written across: the
 * schema itself, the files it imports by relative path, and the shared shorthand
 * modules behind core's configuration barrel. One hop each way, which is as far
 * as a normalizer has ever been split.
 */
function reachableFrom(file: string, text: string) {
  const relative = (from: string, source: string) =>
    [...source.matchAll(/from '(\.[^']+\.ts)'/g)]
      .map(m => path.resolve(path.dirname(from), m[1]!))
      .filter(f => existsSync(f))
  const barrel = (source: string) => {
    const named = [
      ...source.matchAll(
        /import \{([^}]*)\} from '(?:@jbrowse\/core\/configuration|[^']*\/configuration\/index\.ts)'/g,
      ),
    ].flatMap(m => m[1]!.split(',').map(s => s.trim()))
    if (named.length === 0 || !existsSync(CORE_CONFIGURATION)) {
      return []
    }
    const index = readFileSync(CORE_CONFIGURATION, 'utf8')
    return [...index.matchAll(/export \{([^}]*)\} from '(\.[^']+\.ts)'/g)]
      .filter(m =>
        m[1]!
          .split(',')
          .map(s => s.trim())
          .some(name => named.includes(name)),
      )
      .map(m => path.resolve(path.dirname(CORE_CONFIGURATION), m[2]!))
      .filter(f => existsSync(f))
  }
  const seen = new Set([file])
  const sources = [text]
  for (const dep of [...relative(file, text), ...barrel(text)]) {
    if (seen.has(dep)) {
      continue
    }
    seen.add(dep)
    const depText = readFileSync(dep, 'utf8')
    sources.push(depText)
    for (const inner of relative(dep, depText)) {
      if (!seen.has(inner)) {
        seen.add(inner)
        sources.push(readFileSync(inner, 'utf8'))
      }
    }
  }
  return sources
}

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
    for (const source of reachableFrom(file, text)) {
      for (const key of keysRead(source)) {
        keys.add(key)
      }
    }
  }
  // `type` is on every snapshot and is what the probe holds constant, so it is
  // never a shorthand; dropping it here keeps it out of the leftovers retry.
  keys.delete('type')
  // `index`, `indexType` and `location` are declared slots a helper READS to see
  // what the config already asked for, not keys it accepts. Probing one reports
  // it as a shorthand on the adapter that declares it: true, and noise in the
  // docs built off this.
  for (const declared of ['index', 'indexType', 'location']) {
    keys.delete(declared)
  }
  // One sentinel per source the scan has to reach: `uri` the adapter schemas,
  // `csi` the shared shorthand behind core's barrel, `bed1` a plugin-local
  // helper. Three keys have gone missing here — `nhUri` from the hand-listed
  // literal this scan replaced, `csi` when BAM's index derivation moved to a
  // shared helper, `bed1` when a normalizer destructured its snapshot — and each
  // time `jbrowse validate` called a documented key an unknown slot.
  for (const key of ['uri', 'csi', 'bed1']) {
    if (!keys.has(key)) {
      throw new Error(
        `collectShorthandProbes found no \`${key}\` — the scan is not reaching the adapter schemas or a normalizer they import`,
      )
    }
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

const dir = mkdtempSync(path.join(tmpdir(), 'jbrowse-schema-'))
// jbrowse-web's session model imports permanentPlugins.ts, which reads the page
// URL and localStorage at module load; the schema wants the model's properties
// only, so the bundle gets a stub in its place.
const permanentPluginsStub = path.join(dir, 'permanentPlugins.ts')
writeFileSync(
  permanentPluginsStub,
  [
    'readPermanentPlugins',
    'permanentPluginSafeMode',
    'permanentPluginSafeModeSuspects',
    'addPermanentPlugin',
    'removePermanentPlugin',
    'setPermanentPluginDisabled',
    'clearPermanentPlugins',
    'onPermanentPluginsChanged',
    'reloadWithPermanentPlugins',
    'reloadInSafeMode',
    'getPermanentPlugins',
    'markPermanentPluginLoadFinished',
    'setPermanentPlugins',
  ]
    .map(name => `export const ${name} = () => []`)
    .join('\n'),
)

const built = await esbuild.build({
  plugins: [
    {
      name: 'stub-permanent-plugins',
      setup(build) {
        build.onResolve({ filter: /permanentPlugins\.ts$/ }, () => ({
          path: permanentPluginsStub,
        }))
      },
    },
  ],
  stdin: {
    contents: ENTRY.replace('__SHORTHAND_PROBES__', () =>
      JSON.stringify(collectShorthandProbes()),
    )
      .replace('__SCHEMA_ID__', JSON.stringify(SCHEMA_ID))
      .replace('__VERSION__', JSON.stringify(VERSION)),
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
// jbrowse-web's session model imports permanentPlugins.ts, which reads the
// page URL at module load; nothing else in the bundle touches the window.
try {
  console.log = (...args: unknown[]) => {
    payload += args.join(' ')
  }
  await import(pathToFileURL(bundlePath).href)
} finally {
  console.log = originalLog
  rmSync(dir, { recursive: true, force: true })
}

const { manifest: schema, schema: jsonSchema } = JSON.parse(payload) as {
  manifest: Record<string, any>
  schema: Record<string, unknown>
}
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

// Some displays take their schema from a shared one (the multi-sample variant
// displays from SharedVariantDisplay), and the #config tag — so the docs page —
// lives on the shared one. Saying "no docs page" for those is wrong: the slots
// are documented, just under another name. Find the Shared* page that names the
// type.
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
    {
      path: SCHEMA_OUT,
      // A template literal rather than an object literal: the schema's `then`
      // keys read as thenables to the linter, and V8 parses JSON faster than
      // a literal of this size anyway.
      content: [
        '// Generated by scripts/generateConfigManifest.ts — do not edit by hand.',
        '// Regenerate with `pnpm autogen` after changing any configSchema.ts.',
        'export const configJsonSchema: Record<string, unknown> = JSON.parse(`',
        JSON.stringify(jsonSchema, null, 2)
          .replaceAll('\\', '\\\\')
          .replaceAll('`', '\\`')
          .replaceAll('${', '\\${'),
        '`)',
        '',
      ].join('\n'),
      label: path.relative(REPO_ROOT, SCHEMA_OUT),
    },
    {
      path: SCHEMA_SITE_OUT,
      content: formatMarkdown(
        JSON.stringify(jsonSchema, null, 2),
        SCHEMA_SITE_OUT,
      ),
      label: path.relative(REPO_ROOT, SCHEMA_SITE_OUT),
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
