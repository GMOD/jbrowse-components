import { formats, matchFormat } from '@jbrowse/add-track-core'
import {
  guessTrack,
  guessTrackType as cliGuessTrackType,
  makeLocationProtocol,
} from '@jbrowse/cli/src/commands/add-track-utils/adapter-utils.ts'
import PluginManager from '@jbrowse/core/PluginManager'

import corePlugins from './corePlugins.ts'

import type { FileLocation } from '@jbrowse/core/util/types'

jest.mock('./makeWorkerInstance', () => () => {})

// One filename per format-table entry, so an entry added without a matching
// name here fails `every regex entry has a sample filename` below rather than
// going untested. The names are what a user actually types, not minimal regex
// witnesses -- `.bg.bgz` and `.fas` are here because each was supported on
// exactly one of the two sides before the table was shared.
const samples: Record<string, string[]> = {
  BamAdapter: ['volvox.bam'],
  CramAdapter: ['volvox.cram'],
  SamAdapter: ['volvox.sam', 'volvox.sam.gz'],
  Gff3TabixAdapter: ['volvox.gff3.gz', 'volvox.gff.bgz'],
  Gff3Adapter: ['volvox.gff3', 'volvox.gff'],
  GtfTabixAdapter: ['volvox.gtf.gz', 'volvox.gtf.bgz'],
  GtfAdapter: ['volvox.gtf'],
  VcfTabixAdapter: ['volvox.vcf.gz', 'volvox.vcf.bgz'],
  VcfAdapter: ['volvox.vcf'],
  PlinkLDTabixAdapter: ['volvox.ld.gz', 'volvox.ld.bgz'],
  PlinkLDAdapter: ['volvox.ld'],
  BedpeAdapter: ['volvox.bedpe', 'volvox.bedpe.gz'],
  StarFusionAdapter: [
    'volvox.star-fusion.tsv',
    'sample.fusion_predictions.abridged.tsv',
    'volvox.starfusion.tsv.gz',
  ],
  BedTabixAdapter: ['volvox.bed.gz', 'volvox.bed.bgz', 'volvox.bedmethyl.gz'],
  BedGraphTabixAdapter: ['volvox.bg.gz', 'volvox.bg.bgz'],
  BedGraphAdapter: ['volvox.bg'],
  PairwiseIndexedPAFAdapter: ['volvox.pif.gz', 'volvox.pif.bgz'],
  BedAdapter: ['volvox.bed'],
  BigBedAdapter: ['volvox.bb', 'volvox.bigbed'],
  BigWigAdapter: ['volvox.bw', 'volvox.bigwig'],
  GWASAdapter: ['volvox.txt.gz'],
  BgzipFastaAdapter: ['volvox.fa.gz', 'volvox.fasta.bgz', 'volvox.fas.gz'],
  IndexedFastaAdapter: ['volvox.fa', 'volvox.fasta', 'volvox.fas'],
  TwoBitAdapter: ['volvox.2bit'],
  NCListAdapter: ['trackData.json', 'trackData.jsonz'],
  SPARQLAdapter: ['sparql'],
  HicAdapter: ['volvox.hic'],
  PAFAdapter: ['volvox.paf', 'volvox.paf.gz'],
  MashMapAdapter: ['volvox.out', 'volvox.out.gz'],
  ChainAdapter: ['volvox.chain', 'volvox.chain.gz'],
  DeltaAdapter: ['volvox.delta', 'volvox.delta.gz'],
  MCScanSimpleAnchorsAdapter: [
    'volvox.anchors.simple',
    'volvox.anchors.simple.gz',
  ],
  MCScanAnchorsAdapter: ['volvox.anchors', 'volvox.anchors.gz'],
}

const base = 'https://example.com/data'
const mapLocation = makeLocationProtocol('uri')

function setup() {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()
  pluginManager.configure()
  return {
    pluginManager,
    guessAdapter: pluginManager.evaluateExtensionPoint(
      'Core-guessAdapterForLocation',
      () => undefined,
    ),
    guessTrackType: pluginManager.evaluateExtensionPoint(
      'Core-guessTrackTypeForLocation',
      () => undefined,
    ),
  }
}

function uri(s: string): FileLocation {
  return { uri: s, locationType: 'UriLocation' }
}

// undefined-valued keys are how the CLI spells "no --bed1 was passed"; the app
// has no such flag and omits them, and neither writes them to a config file
function dropUndefined(o: unknown) {
  return JSON.parse(JSON.stringify(o)) as unknown
}

const withRegex = formats.filter(f => f.regex)
const cases = Object.entries(samples).flatMap(([adapterType, names]) =>
  names.map(name => [name, adapterType] as const),
)

// The index the "index file" field of the add-track form would carry, for the
// formats that take one. Deliberately not the conventional sibling name: a
// builder that derives every sidecar from the data file instead of using what
// it was handed still produces a plausible config, so the explicit path has to
// be somewhere the derivation cannot reach. `.csi` where the format allows one,
// which is also what makes the indexType branch observable.
function explicitIndex(fileName: string) {
  const spec = matchFormat(fileName)?.spec
  if (spec?.kind === 'indexed') {
    return `${base}/indexes/${fileName}.csi`
  }
  const fromIndex =
    spec?.kind === 'sidecar' && spec.sidecars.find(s => s.fromIndex)
  return fromIndex
    ? `${base}/indexes/${fileName}${fromIndex.suffix}`
    : undefined
}

const indexCases = cases.filter(([name]) => explicitIndex(name))

// The table describes formats; whether a build can open one is decided by the
// adapter registry. An entry naming an adapter no plugin registers therefore
// guesses nothing, silently -- which is what `.h5` -> LdmatAdapter was.
test('every format table entry names a registered adapter', () => {
  const { pluginManager } = setup()
  const unowned = formats
    .map(f => ('adapterType' in f.spec ? f.spec.adapterType : undefined))
    .filter(t => t && !pluginManager.hasAdapterType(t))
  expect(unowned).toEqual([])
})

test('every regex entry has a sample filename', () => {
  const covered = new Set(Object.keys(samples))
  const missing = withRegex
    .map(f => ('adapterType' in f.spec ? f.spec.adapterType : undefined))
    .filter(t => t && !covered.has(t))
  expect(missing).toEqual([])
})

test.each(cases)('%s guesses %s in the app', (name, adapterType) => {
  const { guessAdapter } = setup()
  expect(guessAdapter(uri(`${base}/${name}`), undefined, undefined)?.type).toBe(
    adapterType,
  )
})

// Two hand-written switches walk the same AdapterSpec union -- core's
// adapterConfigFromSpec and the CLI's buildFromSpec, which additionally probes
// for the sidecars it has to copy. Sharing the table does not make them agree,
// so compare what each writes.
test.each(cases)('%s gets the same config from the CLI', name => {
  const { guessAdapter, guessTrackType } = setup()
  const location = `${base}/${name}`
  const app = guessAdapter(uri(location), undefined, undefined)
  const cli = guessTrack({ location, mapLocation })
  expect(dropUndefined(cli.adapter)).toEqual(dropUndefined(app))
  expect(cliGuessTrackType(app!.type, location)).toBe(
    guessTrackType(app!.type, uri(location)) ?? 'FeatureTrack',
  )
})

test.each(indexCases)('%s uses the index it was handed', name => {
  const { guessAdapter } = setup()
  const location = `${base}/${name}`
  const index = explicitIndex(name)!
  const app = guessAdapter(uri(location), uri(index), undefined)
  const cli = guessTrack({ location, index, mapLocation })
  expect(JSON.stringify(app)).toContain(index)
  expect(dropUndefined(cli.adapter)).toEqual(dropUndefined(app))
})

test.each(cases)('%s copies the file it points at', (name, adapterType) => {
  const location = `${base}/${name}`
  const { adapter, files } = guessTrack({ location, mapLocation })
  const locations = Object.values(adapter).flatMap(v =>
    typeof v === 'object' && v && 'uri' in v
      ? [(v as { uri: string }).uri]
      : [],
  )
  expect(adapter.type).toBe(adapterType)
  expect(files.filter(Boolean)).toEqual(expect.arrayContaining(locations))
})

// A format whose extension another format already owns is reachable only by
// name; the add-track form's adapter picker is what passes one.
test.each(
  formats
    .filter(f => !f.regex && 'adapterType' in f.spec)
    .map(f => [(f.spec as { adapterType: string }).adapterType] as const),
)('%s is reachable by an explicit hint', adapterType => {
  const { guessAdapter } = setup()
  expect(
    guessAdapter(uri(`${base}/whatever.dat`), undefined, adapterType)?.type,
  ).toBe(adapterType)
})
