import { track, volvoxAssembly } from './rScript.fixture.ts'
import {
  assemblyArgument,
  exportTracksToR,
  locusOf,
  rValue,
} from './rScript.ts'

const ONE = [{ refName: 'ctgA', start: 1000, end: 9000 }]
const TWO = [
  { refName: 'ctgA', start: 1000, end: 4000 },
  { refName: 'ctgA', start: 6000, end: 9000 },
]

function scriptOf(...args: Parameters<typeof exportTracksToR>) {
  return exportTracksToR(...args).script!
}

test('a locus reads as JBrowse’s location box writes it', () => {
  expect(locusOf('ctgA', 1000, 9000)).toBe('ctgA:1,001-9,000')
  expect(locusOf('chr1', 0, 1234567)).toBe('chr1:1-1,234,567')
})

test('each track is a ggjbrowse reader, and the figure is one jbrowse_stack call', () => {
  const script = scriptOf({
    regions: ONE,
    bpPerPx: 8000 / 1500,
    tracks: [
      track('gff3tabix_genes', 'LinearBasicDisplay', {
        heightMode: 'fit',
        height: 100,
      }),
      track('volvox_microarray', 'LinearWiggleDisplay'),
      track('volvox_alignments', 'LinearAlignmentsDisplay', {
        encoding: { color: { field: 'mapq' } },
      }),
    ],
  })
  expect(script).toContain('locus <- "ctgA:1,001-9,000"')
  expect(script).toMatch(
    /gff3tabix_genes <- jbrowse_features\(".*volvox\.sort\.gff3\.gz",\n {2}locus,\n {2}display = list\(heightMode = "fit", height = 100\),\n {2}width = width\)/,
  )
  expect(script).toContain('\nwidth <- 1500\n')
  expect(script).toContain(
    'display = list(encoding = list(color = list(field = "mapq"))),\n  width = width)',
  )
  expect(script).toContain(
    'fig <- jbrowse_stack(gff3tabix_genes, volvox_microarray, volvox_alignments)\nprint(fig)\n',
  )
  expect(script).toContain(
    'ggplot2::ggsave("figure.png", fig, width = jbrowse_width(fig), height = jbrowse_height(fig))',
  )
  expect(script).toContain('packageVersion("ggjbrowse") < "0.10.0"')
  expect(script).toContain('remotes::install_github(\\"GMOD/ggjbrowse\\")')
  const code = script
    .split('\n')
    .filter(line => !line.startsWith('#'))
    .join('\n')
  expect(script).toContain(
    '#   fig & ggplot2::theme_classic()\n#   autoplot(volvox_alignments, "pileup") + ggplot2::theme_classic()\n',
  )
  expect(code).not.toMatch(/region_layout|jbrowse_regions|geom_jbrowse/)
})

test("a track named width keeps the script's width", () => {
  const script = scriptOf({
    regions: ONE,
    bpPerPx: 8000 / 1500,
    tracks: [
      {
        ...track('volvox_microarray', 'LinearWiggleDisplay'),
        trackId: 'width',
      },
    ],
  })
  expect(script).toContain('\nwidth <- 1500\n')
  expect(script).toMatch(/^width_2 <- jbrowse_wiggle\(/m)
})

test('every reader lays its track out at the view’s width, and none without a zoom', () => {
  const tracks = [
    track('volvox_alignments', 'LinearAlignmentsDisplay'),
    track('volvox_test_vcf', 'LinearMultiSampleVariantDisplay'),
  ]
  const script = scriptOf({ regions: ONE, bpPerPx: 8000 / 1500, tracks })
  expect(script).toContain('\nwidth <- 1500\n')
  expect(script.match(/\n {2}width = width/g)).toHaveLength(2)
  expect(scriptOf({ regions: ONE, tracks })).not.toMatch(
    /width <-|width = width/,
  )
})

test('several regions are one vector of loci, which the readers draw end to end', () => {
  const script = scriptOf({
    regions: TWO,
    tracks: [track('volvox_alignments', 'LinearAlignmentsDisplay')],
  })
  expect(script).toContain('locus <- c("ctgA:1,001-4,000", "ctgA:6,001-9,000")')
})

test('every reader takes the view’s assembly, which names each contig as each file spells it', () => {
  const script = scriptOf({
    regions: ONE,
    assembly: volvoxAssembly(),
    tracks: [
      track('volvox_alignments', 'LinearAlignmentsDisplay'),
      track('volvox_test_vcf', 'LinearMultiSampleVariantDisplay'),
    ],
  })
  expect(script).toContain('locus <- "ctgA:1,001-9,000"')
  expect(script).toMatch(
    /\nassembly <- list\(name = "volvox", sequence = list\(adapter = list\(type = "TwoBitAdapter", twoBitLocation = list\(uri = ".*volvox\.2bit"\)\)\), refNameAliases = list\(adapter = list\(type = "FromConfigAdapter", .*aliases = c\("A", "contigA"\)/,
  )
  expect(script.match(/\n {2}assembly = assembly/g)).toHaveLength(2)
  expect(script).not.toMatch(/reference(_chrom)? =/)
})

test('an assembly ggjbrowse builds from its files’ paths reads as jbrowse_assembly()', () => {
  const value = (snapshot: Record<string, unknown>) => {
    const a = assemblyArgument(snapshot)
    return 'value' in a ? a.value : a.skipped
  }
  expect(
    value({
      name: 'hg19',
      uri: '/data/hg19.fa.gz',
      refNameAliases: { uri: '/data/hg19_aliases.txt' },
    }),
  ).toBe(
    'jbrowse_assembly("/data/hg19.fa.gz", "/data/hg19_aliases.txt", name = "hg19")',
  )
  const fasta = (faiLocation: Record<string, unknown>) =>
    value({
      name: 'g',
      sequence: {
        type: 'ReferenceSequenceTrack',
        trackId: 'g-seq',
        adapter: {
          type: 'IndexedFastaAdapter',
          fastaLocation: { uri: '/data/g.fa' },
          faiLocation,
        },
      },
    })
  expect(fasta({ uri: '/data/g.fa.fai' })).toBe(
    'jbrowse_assembly("/data/g.fa", name = "g")',
  )
  expect(fasta({ uri: '/index/g.fai' })).toContain(
    'faiLocation = list(uri = "/index/g.fai")',
  )
  expect(value({ name: 'g', uri: 'blob:http://host/1' })).toContain(
    'opened in the browser',
  )
})

test('an adapter with a setting of its own crosses as its config', () => {
  const script = scriptOf({
    regions: ONE,
    tracks: [
      {
        ...track('bigbed_genes', 'LinearBasicDisplay'),
        adapter: {
          type: 'BigBedAdapter',
          bigBedLocation: { localPath: '/data/genes.bb' },
          aggregateField: 'geneName',
        },
      },
    ],
  })
  expect(script).toContain(
    'jbrowse_features(list(type = "BigBedAdapter", bigBedLocation = list(uri = "/data/genes.bb"), aggregateField = "geneName"),',
  )
})

test('a tabix GTF reads by its path, as ggjbrowse picks GtfTabixAdapter for .gtf.gz', () => {
  const script = scriptOf({
    regions: ONE,
    tracks: [
      {
        ...track('bigbed_genes', 'LinearBasicDisplay'),
        adapter: {
          type: 'GtfTabixAdapter',
          gtfGzLocation: { uri: '/data/genes.gtf.gz' },
          index: { location: { uri: '/data/genes.gtf.gz.tbi' } },
        },
      },
    ],
  })
  expect(script).toContain('jbrowse_features("/data/genes.gtf.gz",\n  locus')
})

test('variant tracks read as their displays draw them', () => {
  const script = scriptOf({
    regions: ONE,
    tracks: [
      track('volvox_filtered_vcf', 'LinearVariantDisplay'),
      track('volvox_test_vcf', 'LinearMultiSampleVariantDisplay'),
    ],
  })
  expect(script).toMatch(/volvox_filtered_vcf <- jbrowse_features\(/)
  expect(script).toMatch(/volvox_test_vcf <- jbrowse_variants\(/)
})

test('the header names what the figure leaves out, and an unreadable track does not stop it', () => {
  const { script, notes, drawn } = exportTracksToR({
    regions: ONE,
    tracks: [
      track('volvox_microarray', 'LinearWiggleDisplay'),
      track('volvox_microarray', 'LinearManhattanDisplay'),
      {
        ...track('volvox_microarray', 'LinearWiggleDisplay'),
        trackId: 'opened',
        trackName: 'Opened',
        adapter: { type: 'BigWigAdapter', bigWigLocation: { uri: 'blob:x' } },
      },
    ],
  })
  expect(drawn).toBe(1)
  expect(notes).toEqual([
    'wiggle_track xyplot: LinearManhattanDisplay has no R reader in ggjbrowse yet',
    'Opened: it reads a file opened in the browser, which R cannot reach',
  ])
  expect(script).toContain('#   - Opened: it reads a file opened')
})

test('a read colored by its mate’s contig says the figure hashes the contigs', () => {
  const { notes } = exportTracksToR({
    regions: ONE,
    tracks: [
      track('volvox_alignments', 'LinearAlignmentsDisplay', {
        encoding: { color: { field: 'mateRefName' } },
      }),
    ],
  })
  expect(notes).toEqual([
    expect.stringContaining('mateRefName colors each contig by its hash'),
  ])
})

test('a config value crosses as the R literal ggjbrowse hands the engine', () => {
  expect(
    rValue({ a: [1, 2], b: [], c: [{ x: 'y' }], 'd-e': true, f: null }),
  ).toBe(
    'list(a = c(1, 2), b = list(), c = list(list(x = "y")), "d-e" = TRUE, f = NULL)',
  )
})
