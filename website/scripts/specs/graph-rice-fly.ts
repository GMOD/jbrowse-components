import { sessionSpec } from '../screenshot-spec-helpers.ts'
import { GRAPH_DRAWN, cutNear, graphTrack, local } from './graph-fixtures.ts'

import type { Annotation, ScreenshotSpec } from '../screenshot-spec-types.ts'

const CONFIG = local('test_data/graphgenomeview/pangenome_nonhuman.json')

interface Species {
  assembly: string
  genes: string
  vcf: string
  graph: string
  vcfHeight: number
}

const rice: Species = {
  assembly: 'GCF_034140825.1',
  genes: 'GCF_034140825.1-ncbiRefSeq',
  vcf: 'rice_pangenome_vcf',
  graph: 'rice_minigraph_segments',
  vcfHeight: 600,
}

const fly: Species = {
  assembly: 'dm6',
  genes: 'dm6_ncbiRefSeq_ucsc',
  vcf: 'fly_pangenome_vcf',
  graph: 'fly_minigraph_segments',
  vcfHeight: 560,
}

interface Locus {
  name: string
  species: Species
  loc: string
  // the 0-based position the rows sort by genotype at, inside the record
  sortAt: number
  graphSpan?: number
  genes?: boolean
  annotations?: Annotation[]
  highlight?: Record<string, unknown>[]
}

// Every figure sorts the callset's rows at the locus's record, as "Sort rows
// by genotype here" does, so each allele's assemblies sit together.
function locusSpec({
  name,
  species,
  loc,
  sortAt,
  graphSpan,
  genes = true,
  annotations,
  highlight,
}: Locus): ScreenshotSpec {
  const refName = loc.split(':')[0]!
  const graphHeight = 260
  return {
    mode: 'url',
    name,
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          id: `${name.replace('/', '-')}-lgv`,
          assembly: species.assembly,
          loc,
          tracks: [
            ...(genes ? [{ trackId: species.genes, height: 70 }] : []),
            {
              trackId: species.vcf,
              height: species.vcfHeight,
              sortRowsBy: { refName, pos: sortAt },
            },
            ...(graphSpan
              ? [
                  graphTrack(species.graph, {
                    layoutMode: 'force',
                    encoding: { color: { field: 'position' } },
                    bubbleSpread: 'compress',
                    paneHeight: graphHeight,
                    maxRegionBp: cutNear(graphSpan),
                  }),
                ]
              : []),
          ],
          ...(highlight ? { highlight } : {}),
        },
      ],
    }),
    ...(graphSpan ? { readySelector: GRAPH_DRAWN } : {}),
    readyTimeout: 300000,
    viewportWidth: 1400,
    viewportHeight:
      (genes ? 330 : 250) +
      species.vcfHeight +
      (graphSpan ? graphHeight + 60 : 0),
    tooltip: 'hide',
    ...(annotations ? { annotations } : {}),
  }
}

const rowCallout = (
  species: Species,
  loc: string,
  row: string,
  text: string,
  dx = 160,
  dy = 0,
): Annotation => ({
  type: 'text',
  text,
  fontSize: 18,
  leader: true,
  anchor: { trackId: species.vcf, loc, row },
  dx,
  dy,
})

const geneCallout = (
  species: Species,
  feature: string,
  text: string,
): Annotation => ({
  type: 'text',
  text,
  fontSize: 18,
  leader: true,
  anchor: { trackId: species.genes, feature },
  dx: 150,
  dy: 35,
})

// Anchored to the segment, so the callout follows the force layout.
const graphCallout = (
  species: Species,
  segment: string,
  text: string,
  dx: number,
  dy: number,
): Annotation => ({
  type: 'text',
  text,
  fontSize: 18,
  leader: true,
  anchor: { trackId: species.graph, graphNode: segment },
  dx,
  dy,
})

const SD1_RECORD = 'chr1:39,013,200'
const QSW5_RECORD = 'chr5:5,380,100'
const PUP1_RECORD = 'chr12:15,866,630'
const CYP28D1_RECORD = 'chr2L:5,211,800'

export const riceFlyGraphSpecs: ScreenshotSpec[] = [
  // The 383 bp record is the sd1-d allele, from inside exon 1 into exon 2's
  // start on LOC4325003 (SD1): segment s25454, which its carriers skip by
  // the 1 bp s362635.
  locusSpec({
    name: 'pangenome/rice_sd1',
    species: rice,
    loc: 'chr1:39,008,001-39,020,000',
    sortAt: 39_013_200,
    graphSpan: 12_000,
    annotations: [
      geneCallout(rice, 'LOC4325003', 'SD1'),
      rowCallout(rice, SD1_RECORD, 'IR64', 'sd1-d, a 383 bp deletion', 300),
      graphCallout(rice, 's25454', 'sd1-d: these 383 bp skipped', -260, -70),
    ],
  }),
  // ALEN 504 (AGIS-1.0's 1,212 bp deletion, segment s98373), 1715 (no
  // deletion, s98373 then the 445 bp s284387 and the 766 bp s284388), 766
  // (the 950 bp deletion, s284388 alone).
  locusSpec({
    name: 'pangenome/rice_qsw5',
    species: rice,
    loc: 'chr5:5,374,001-5,390,000',
    sortAt: 5_380_000,
    graphSpan: 16_000,
    annotations: [
      geneCallout(rice, 'LOC4338011', 'GW5'),
      rowCallout(rice, QSW5_RECORD, 'Kasalath', 'no deletion', 300),
      rowCallout(rice, QSW5_RECORD, 'CX20', '950 bp deletion', 300),
      rowCallout(
        rice,
        QSW5_RECORD,
        'Balilla',
        "1,212 bp deletion, AGIS-1.0's",
        300,
      ),
      graphCallout(rice, 's284388', "the 950 bp deletion's path", 200, 70),
    ],
  }),
  // One record, nine alleles: AGIS-1.0's 39 bp path (Balilla alone), a second
  // 39 bp path (allele 1, IR64 among its 29), and seven insertions of 46 to
  // 89 kb, a color each, which the legend names with their ALEN. Kasalath and
  // SL190 share the 88,924 bp one.
  locusSpec({
    name: 'pangenome/rice_pup1',
    species: rice,
    loc: 'chr12:15,866,141-15,866,870',
    sortAt: 15_866_620,
    genes: false,
    annotations: [
      rowCallout(
        rice,
        PUP1_RECORD,
        'IR64',
        "39 bp, no insertion (not AGIS-1.0's path)",
        -120,
      ),
      rowCallout(rice, PUP1_RECORD, 'Balilla', "AGIS-1.0's 39 bp", -120, 10),
    ],
  }),
  // ALEN 1978 (dm6), then 12748 (Canton-S_A1's form), 7257, 17241
  // (BOG1_A2's), 40016 (BER1_B1's), 8042 (RVC3_B4's), 5256. The 15,246 bp
  // s81728 is the copy A2 and B1 walk; the 4,853 bp s78371 is A1's alone.
  locusSpec({
    name: 'pangenome/fly_cyp28d1',
    species: fly,
    loc: 'chr2L:5,200,001-5,220,000',
    sortAt: 5_210_500,
    graphSpan: 20_000,
    annotations: [
      rowCallout(
        fly,
        CYP28D1_RECORD,
        'Canton-S_A1',
        'A1, 11 kb longer',
        260,
        -10,
      ),
      rowCallout(fly, CYP28D1_RECORD, 'BOG1_A2', 'A2, 15 kb longer', 260, -10),
      rowCallout(fly, CYP28D1_RECORD, 'BER1_B1', 'B1, 38 kb longer', 260, 40),
      rowCallout(fly, CYP28D1_RECORD, 'RVC3_B4', 'B4, 6.1 kb longer', 260, 90),
      graphCallout(fly, 's81728', "A2's and B1's 15 kb copy", 200, 0),
      graphCallout(fly, 's78371', 'Canton-S_A1 alone: 4.9 kb', -350, -90),
    ],
  }),
  locusSpec({
    name: 'pangenome/fly_strn_mlck',
    species: fly,
    loc: 'chr2R:15,940,001-15,966,000',
    sortAt: 15_953_908,
    graphSpan: 26_000,
    annotations: [
      rowCallout(
        fly,
        'chr2R:15,953,909',
        'BDSC_156',
        '7.5 kb insertion (DM412)',
      ),
      graphCallout(fly, 's120265', "BDSC_156's 7.5 kb DM412 loop", 200, -60),
    ],
  }),
  locusSpec({
    name: 'pangenome/fly_chkov1',
    species: fly,
    loc: 'chr3R:25,320,001-25,335,000',
    sortAt: 25_326_000,
    graphSpan: 15_000,
    annotations: [
      graphCallout(
        fly,
        's63071',
        'the Doc, 4.5 kb, skipped by 7 strains',
        -200,
        -40,
      ),
    ],
  }),
]
