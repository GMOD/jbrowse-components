import { track } from './rScript.fixture.ts'
import { exportTracksToR, locusOf, rValue } from './rScript.ts'

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
    tracks: [
      track('gff3tabix_genes', 'LinearBasicDisplay', {
        heightMode: 'fit',
        height: 100,
      }),
      track('volvox_microarray', 'LinearWiggleDisplay'),
      track('volvox_alignments', 'LinearAlignmentsDisplay', {
        color: { field: 'mapq' },
      }),
    ],
  })
  expect(script).toContain('locus <- "ctgA:1,001-9,000"')
  expect(script).toMatch(
    /gff3tabix_genes <- jbrowse_features\(".*volvox\.sort\.gff3\.gz",\n {2}locus,\n {2}display = list\(heightMode = "fit", height = 100\),\n {2}width = 1500\)/,
  )
  expect(script).toContain('display = list(color = list(field = "mapq")))')
  expect(script).toContain(
    'fig <- jbrowse_stack(gff3tabix_genes, volvox_microarray, volvox_alignments)\nprint(fig)\n',
  )
  expect(script).toContain('packageVersion("ggjbrowse") < "0.1.1"')
  expect(script).toContain('remotes::install_github(\\"GMOD/ggjbrowse\\")')
  const code = script
    .split('\n')
    .filter(line => !line.startsWith('#'))
    .join('\n')
  expect(script).toContain(
    '#   autoplot(volvox_alignments, "pileup") + geom_jbrowse_mismatches(ggplot2::aes(alpha = quality))',
  )
  expect(code).not.toMatch(/region_layout|jbrowse_regions|geom_jbrowse/)
})

test('several regions are one vector of loci, which the readers draw end to end', () => {
  const script = scriptOf({
    regions: TWO,
    tracks: [track('volvox_alignments', 'LinearAlignmentsDisplay')],
  })
  expect(script).toContain('locus <- c("ctgA:1,001-4,000", "ctgA:6,001-9,000")')
})

test('a file spelling the contig another way reads under its own name', () => {
  const script = scriptOf({
    regions: [{ refName: 'chrA', start: 1000, end: 9000 }],
    tracks: [
      {
        ...track('volvox_alignments', 'LinearAlignmentsDisplay'),
        refNames: { chrA: 'ctgA' },
      },
    ],
  })
  expect(script).toContain('locus <- "chrA:1,001-9,000"')
  expect(script).toMatch(
    /"ctgA:1,001-9,000",\n.*\n {2}reference_chrom = "chrA"/,
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

test('a config value crosses as the R literal ggjbrowse hands the engine', () => {
  expect(
    rValue({ a: [1, 2], b: [], c: [{ x: 'y' }], 'd-e': true, f: null }),
  ).toBe(
    'list(a = c(1, 2), b = list(), c = list(list(x = "y")), "d-e" = TRUE, f = NULL)',
  )
})
