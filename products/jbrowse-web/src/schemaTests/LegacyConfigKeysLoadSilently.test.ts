import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'

import corePlugins from '../corePlugins.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

// Every key a v1-v4 release declared as a config slot and a later one dropped,
// one track per schema it reached. A closed schema names an undeclared key on
// the console as a config loads (ADR-221); a key a shipped release wrote is
// `retired` on its schema instead, so a v4 config loads in silence. A slot
// removed later joins the row for its schema and gets a `retired` entry, or
// this test names it.

const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  .createPluggableElements()
  .configure()

const loc = (uri: string) => ({ uri, locationType: 'UriLocation' })

const track = (
  type: string,
  adapter: Record<string, unknown>,
  display: Record<string, unknown>,
  rest: Record<string, unknown> = {},
) => ({
  type,
  trackId: `${type}-${String(display.type)}`,
  name: 't',
  assemblyNames: ['volvox'],
  adapter,
  displays: [{ ...display, displayId: `${type}-${String(display.type)}-d` }],
  ...rest,
})

const bam = { type: 'BamAdapter', bamLocation: loc('a.bam') }
const vcf = { type: 'VcfTabixAdapter', vcfGzLocation: loc('a.vcf.gz') }
const paf = {
  type: 'PAFAdapter',
  pafLocation: loc('a.paf'),
  assemblyNames: ['volvox', 'volvox2'],
}
const wiggleKeys = {
  autoscale: 'local',
  minScore: 0,
  maxScore: 100,
  scaleType: 'linear',
  inverted: false,
}
const baseKeys = {
  maxFeatureScreenDensity: 5,
  fetchSizeLimit: 1000,
  mouseover: 'jexl:get(feature,"name")',
  jexlFilters: ["get(feature,'score') > 1"],
}

const tracks: Record<string, unknown>[] = [
  track('AlignmentsTrack', bam, {
    type: 'LinearAlignmentsDisplay',
    maxFeatureScreenDensity: 5,
    jexlFilters: ["get(feature,'score') > 1"],
    maxDisplayedBpPerPx: 1000,
    pileupDisplay: {
      type: 'LinearPileupDisplay',
      renderers: { PileupRenderer: { type: 'PileupRenderer', maxHeight: 10 } },
    },
    snpCoverageDisplay: { type: 'LinearSNPCoverageDisplay', height: 40 },
  }),
  track('AlignmentsTrack', bam, {
    type: 'LinearPileupDisplay',
    defaultRendering: 'pileup',
    renderers: { PileupRenderer: { type: 'PileupRenderer' } },
    colorScheme: 'strand',
  }),
  track('AlignmentsTrack', bam, {
    type: 'LinearSNPCoverageDisplay',
    ...wiggleKeys,
    multiTicks: false,
    renderers: { SNPCoverageRenderer: { type: 'SNPCoverageRenderer' } },
  }),
  track('AlignmentsTrack', bam, {
    type: 'LinearReadArcsDisplay',
    jitter: 2,
    lineWidth: 1,
    colorScheme: 'insertSize',
  }),
  track('AlignmentsTrack', bam, {
    type: 'LinearReadCloudDisplay',
    hideSmallIndels: true,
    hideMismatches: true,
    hideLargeIndels: true,
    minSubfeatureWidth: 1,
  }),
  track(
    'FeatureTrack',
    { type: 'Gff3TabixAdapter', gffGzLocation: loc('a.gff.gz') },
    { type: 'LinearBasicDisplay', maxDisplayedBpPerPx: 1000 },
  ),
  track(
    'FeatureTrack',
    { type: 'BedTabixAdapter', bedGzLocation: loc('a.bed.gz') },
    {
      type: 'LinearArcDisplay',
      maxFeatureScreenDensity: 5,
      mouseover: 'jexl:get(feature,"name")',
    },
  ),
  track('VariantTrack', vcf, {
    type: 'MultiLinearVariantDisplay',
    maxFeatureScreenDensity: 5,
    colorBy: 'genotype',
    showReferenceAlleles: true,
    showSidebarLabels: true,
    ...wiggleKeys,
    numStdDev: 3,
    minimalTicks: false,
  }),
  track('VariantTrack', vcf, {
    type: 'LinearVariantMatrixDisplay',
    showSidebarLabels: false,
  }),
  track(
    'LDTrack',
    { type: 'PlinkLDAdapter', ldLocation: loc('a.ld') },
    {
      type: 'LDTrackDisplay',
      maxHeight: 600,
      ...baseKeys,
      colorScheme: 'default',
      signedLD: false,
      showLDTriangle: true,
      showRecombination: false,
      recombinationZoneHeight: 50,
      fitToHeight: true,
      useGenomicPositions: false,
      minorAlleleFrequencyFilter: 0.01,
      lengthCutoffFilter: 1000,
      hweFilterThreshold: 0.001,
      callRateFilter: 0.9,
    },
  ),
  track(
    'QuantitativeTrack',
    { type: 'BigWigAdapter', bigWigLocation: loc('a.bw') },
    { type: 'LinearWiggleDisplay', ...baseKeys },
  ),
  track(
    'HicTrack',
    { type: 'HicAdapter', hicLocation: loc('a.hic') },
    {
      type: 'LinearHicDisplay',
      renderer: {
        type: 'HicRenderer',
        baseColor: 'red',
        color: 'jexl:interpolate(count,scale)',
        maxHeight: 600,
      },
      ...baseKeys,
    },
  ),
  {
    type: 'ReferenceSequenceTrack',
    trackId: 'refseq',
    adapter: {
      type: 'IndexedFastaAdapter',
      fastaLocation: loc('a.fa'),
      faiLocation: loc('a.fa.fai'),
    },
    rendering: 'div',
    displays: [
      {
        type: 'LinearReferenceSequenceDisplay',
        displayId: 'refseq-d',
        renderer: { type: 'DivSequenceRenderer', height: 10 },
      },
    ],
  },
  track('SyntenyTrack', paf, {
    type: 'DotplotDisplay',
    renderer: {
      type: 'DotplotRenderer',
      color: 'black',
      posColor: 'blue',
      negColor: 'red',
      lineWidth: 2,
      colorBy: 'strand',
      thresholds: ['0.5', '0.8'],
      thresholdsPalette: ['red', 'blue'],
    },
  }),
  track(
    'SyntenyTrack',
    paf,
    {
      type: 'LinearSyntenyDisplay',
      renderer: { type: 'LinearSyntenyRenderer', color: 'black' },
      middle: true,
    },
    { trackIds: ['a', 'b'] },
  ),
  track('SyntenyTrack', paf, {
    type: 'LGVSyntenyDisplay',
    maxFeatureScreenDensity: 5,
    jexlFilters: ["get(feature,'score') > 1"],
    colorScheme: 'strand',
    renderers: { PileupRenderer: { type: 'PileupRenderer' } },
    defaultRendering: 'pileup',
  }),
  track(
    'AlignmentsTrack',
    { ...bam, chunkSizeLimit: 1000000 },
    { type: 'LinearAlignmentsDisplay' },
    { textSearchAdapter: 'x', textSearchIndexingAttributes: ['Name'] },
  ),
  track(
    'FeatureTrack',
    { type: 'FromConfigAdapter', features: [], featureClass: 'SimpleFeature' },
    { type: 'LinearBasicDisplay' },
  ),
  track(
    'FeatureTrack',
    {
      type: 'FromConfigRegionsAdapter',
      features: [],
      featureClass: 'SimpleFeature',
    },
    { type: 'LinearBasicDisplay' },
  ),
  track(
    'SyntenyTrack',
    {
      type: 'MCScanAnchorsAdapter',
      mcscanAnchorsLocation: loc('a.anchors'),
      bed1Location: loc('a.bed'),
      bed2Location: loc('b.bed'),
      assemblyNames: ['volvox', 'volvox2'],
      subadapters: [],
    },
    { type: 'LinearSyntenyDisplay' },
  ),
]

const adapters: Record<string, unknown>[] = [
  {
    type: 'FromConfigSequenceAdapter',
    features: [],
    featureClass: 'SimpleFeature',
  },
  { type: 'CytobandAdapter', cytobandsLocation: loc('a.txt') },
  {
    type: 'NcbiSequenceReportAliasAdapter',
    location: loc('a.jsonl'),
    useUcscNameOverride: true,
  },
]

function undeclaredLines(load: () => unknown) {
  const lines: string[] = []
  const spy = jest.spyOn(console, 'warn').mockImplementation((...args) => {
    const line = args.map(String).join(' ')
    if (line.includes('does not declare')) {
      lines.push(line)
    }
  })
  try {
    load()
  } finally {
    spy.mockRestore()
  }
  return lines
}

test.each(tracks.map(t => [t.trackId as string, t] as const))(
  'a v4 %s config loads without a console line',
  (_id, snap) => {
    const { configSchema } = pluginManager.getTrackType(snap.type as string)
    expect(
      undeclaredLines(() => configSchema.create(snap, { pluginManager })),
    ).toEqual([])
  },
)

test.each(adapters.map(a => [a.type as string, a] as const))(
  'a v4 %s config loads without a console line',
  (type, snap) => {
    const { configSchema } = pluginManager.getAdapterType(type)
    expect(undeclaredLines(() => configSchema.create(snap))).toEqual([])
  },
)

function loaded(snap: Record<string, unknown>) {
  const { configSchema } = pluginManager.getTrackType(snap.type as string)
  const track = configSchema.create(snap, {
    pluginManager,
  }) as AnyConfigurationModel & { displays: AnyConfigurationModel[] }
  return track.displays[0]!
}

const byDisplay = (type: string) =>
  tracks.find(t => (t.displays as { type: string }[])[0]!.type === type)!

// A key whose value a current slot takes lands there, which the console line
// alone cannot show.
test.each([
  ['LinearAlignmentsDisplay', 'maxHeight', 10],
  ['LinearAlignmentsDisplay', 'coverageHeight', 40],
  ['LinearSNPCoverageDisplay', ['scales', 'y', 'domainMin'], 0],
  ['LinearSNPCoverageDisplay', ['scales', 'y', 'domainMax'], 100],
  ['LinearReadArcsDisplay', 'readConnectionsLineWidth', 1],
  ['LinearReadCloudDisplay', 'showMismatches', false],
  ['MultiLinearVariantDisplay', 'showRowLabels', true],
  ['MultiLinearVariantDisplay', 'referenceDrawingMode', 'draw'],
  ['LinearVariantMatrixDisplay', 'showRowLabels', false],
  ['LDTrackDisplay', 'squashToHeight', true],
  ['LDTrackDisplay', 'variantLayout', 'columns'],
] as const)('%s: a v4 key lands on %s', (type, slot, value) => {
  expect(readConfObject(loaded(byDisplay(type)), slot as string)).toEqual(value)
})

test('a renamed adapter key lands on its slot', () => {
  const cytoband = pluginManager
    .getAdapterType('CytobandAdapter')
    .configSchema.create(adapters[1]!)
  expect(readConfObject(cytoband, 'cytobandLocation')).toEqual(loc('a.txt'))
  const ncbi = pluginManager
    .getAdapterType('NcbiSequenceReportAliasAdapter')
    .configSchema.create(adapters[2]!)
  expect(readConfObject(ncbi, 'useNameOverride')).toBe(true)
})
