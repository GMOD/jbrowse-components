import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import {
  configTracks,
  hasR,
  runCases,
  track,
  volvoxAssembly,
} from './rScript.fixture.ts'
import { exportTracksToR } from './rScript.ts'

import type { RCase } from './rScript.fixture.ts'
import type { RExportTrack, Region } from './rScript.ts'

/**
 * Each case runs an emitted script under Rscript, figure and all, then asks R
 * what its tracks read: a script that exits 0 drawing the wrong data is the
 * failure these catch and a string check cannot.
 */
const dir = mkdtempSync(path.join(tmpdir(), 'rexport-run-'))
const ONE = [{ refName: 'ctgA', start: 1000, end: 9000 }]
const TWO = [
  { refName: 'ctgA', start: 1000, end: 4000 },
  { refName: 'ctgA', start: 6000, end: 9000 },
]
const cases: RCase[] = []

/** The zoom of a view 1,500 pixels wide over `regions`. */
const bpPerPxOf = (regions: Region[]) =>
  regions.reduce((sum, r) => sum + r.end - r.start, 0) / 1500

function register(
  name: string,
  tracks: RExportTrack[],
  probe: string,
  regions: Region[] = ONE,
) {
  if (cases.some(c => c.name === name)) {
    throw new Error(`two cases named ${name} would share one script file`)
  }
  const out = path.join(dir, `${name}.png`)
  cases.push({
    name,
    script: exportTracksToR({
      tracks,
      regions,
      assembly: volvoxAssembly(),
      out,
      bpPerPx: bpPerPxOf(regions),
    }).script!,
    probe: `c(file.size(${JSON.stringify(out)}) > 0, ${probe})`,
  })
  return name
}

const stack = register(
  'stack',
  [
    track('gff3tabix_genes', 'LinearBasicDisplay'),
    track('volvox_microarray', 'LinearWiggleDisplay'),
    track('volvox_alignments', 'LinearAlignmentsDisplay'),
    track('volvox_cram_alignments_ctga', 'LinearAlignmentsDisplay'),
    track('volvox_filtered_vcf', 'LinearVariantDisplay'),
    track('volvox_test_vcf', 'LinearMultiSampleVariantDisplay'),
  ],
  `nrow(gff3tabix_genes$features) > 0, nrow(volvox_microarray$bins) > 0,
  nrow(volvox_alignments$reads) > 0, nrow(volvox_cram_alignments_ctga$reads) > 0,
  nrow(volvox_filtered_vcf$features) > 0, nrow(volvox_test_vcf$cells) > 0`,
)

const restyleExamples = (script: string) =>
  script
    .split('\n')
    .filter(line => /^# {3}(fig|autoplot)\b/.test(line))
    .map(line => `print(${line.slice(4)})`)

const restyled = (name: string, tracks: RExportTrack[]) => {
  const { script } = exportTracksToR({ tracks, regions: ONE })
  return register(
    name,
    tracks,
    `{ ${restyleExamples(script!).join('; ')}; TRUE }`,
  )
}
const restyledReads = restyled('restyle_reads', [
  track('gff3tabix_genes', 'LinearBasicDisplay'),
  track('volvox_alignments', 'LinearAlignmentsDisplay'),
])
const restyledGenes = restyled('restyle_genes', [
  track('gff3tabix_genes', 'LinearBasicDisplay'),
])

const twoRegions = register(
  'two_regions',
  [
    track('gff3tabix_genes', 'LinearBasicDisplay'),
    track('volvox_alignments', 'LinearAlignmentsDisplay'),
  ],
  `identical(sort(unique(volvox_alignments$reads$region)), 1:2),
  identical(sort(unique(gff3tabix_genes$features$region)), 1:2)`,
  TWO,
)

const aliased = register(
  'aliased',
  [track('volvox_test_vcf', 'LinearMultiSampleVariantDisplay')],
  `nrow(volvox_test_vcf$cells) > 0,
  identical(unique(volvox_test_vcf$variants$chrom), "ctgA")`,
)

const READ_NAME = 'ctgA_1405_1888_3:0:0_5:0:0_21c4'
const filtered = register(
  'filtered',
  [
    track('volvox_alignments', 'LinearAlignmentsDisplay', {
      filter: { flagExclude: 1556, readName: READ_NAME },
    }),
  ],
  `unique(volvox_alignments$reads$name) == ${JSON.stringify(READ_NAME)}`,
)

const edenLabel = (heightMode: string) =>
  register(
    `labels_${heightMode}`,
    [
      track('gff3tabix_genes', 'LinearBasicDisplay', {
        heightMode,
        height: 100,
      }),
    ],
    '"EDEN" %in% gff3tabix_genes$labels$text',
    [{ refName: 'ctgA', start: 0, end: 25000 }],
  )
const fitLabels = edenLabel('fit')
const grownLabels = edenLabel('grow')

const multiWiggle = register(
  'multi_wiggle',
  [
    track(
      'volvox_microarray_multi_multirowxy',
      'LinearWiggleDisplay',
      configTracks().get('volvox_microarray_multi_multirowxy')!.displays![0],
    ),
  ],
  `volvox_microarray_multi_multirowxy$row_layout,
  identical(unique(as.character(volvox_microarray_multi_multirowxy$marks$color)), "#0068d1")`,
)

const bigBed = register(
  'bigbed',
  [
    {
      ...track('bigbed_genes', 'LinearBasicDisplay', { heightMode: 'grow' }),
      adapter: {
        type: 'BigBedAdapter',
        bigBedLocation: {
          localPath: path.resolve('test_data/volvox/volvox.bb'),
        },
        aggregateField: 'geneName',
      },
    },
  ],
  `{ f <- bigbed_genes$features; eden <- which(f$name == "EDEN")
  sum(bigbed_genes$subfeatures$feature == eden) == 3 }`,
  [{ refName: 'ctgA', start: 0, end: 25000 }],
)

const lackingContig = register(
  'lacking_contig',
  [track('volvox_microarray', 'LinearWiggleDisplay')],
  'all(volvox_microarray$bins$region == 1)',
  [
    { refName: 'ctgA', start: 1000, end: 4000 },
    { refName: 'ctgB', start: 0, end: 3000 },
  ],
)

const maybe = hasR() ? describe : describe.skip

maybe('an exported script, run under R', () => {
  const results = new Map<string, string>()
  beforeAll(() => {
    for (const [k, v] of runCases(cases)) {
      results.set(k, v)
    }
  }, 600_000)

  const allTrue = (name: string) => {
    expect(results.get(name)).toMatch(/^\[1\](\s+TRUE)+$/)
  }

  it('draws every reader’s track into one figure', () => {
    allTrue(stack)
    expect(results.get(stack)!.match(/TRUE/g)).toHaveLength(7)
  })

  it('runs the header’s restyle example as written', () => {
    allTrue(restyledReads)
    allTrue(restyledGenes)
  })

  it('draws several regions end to end', () => {
    allTrue(twoRegions)
  })

  it('reads a file under the name it spells a contig with', () => {
    allTrue(aliased)
  })

  it('hands the engine the display’s filter', () => {
    allTrue(filtered)
  })

  it('fits a feature track to the view’s height as the browser does', () => {
    expect(results.get(fitLabels)).toMatch(/^\[1\]\s+TRUE\s+FALSE$/)
    allTrue(grownLabels)
  })

  it('draws a multi-BigWig a row per source, in the browser’s blue', () => {
    allTrue(multiWiggle)
  })

  it('hands the engine an adapter’s own settings', () => {
    allTrue(bigBed)
  })

  it('draws a track whose file lacks one region’s contig', () => {
    allTrue(lackingContig)
  })
})
