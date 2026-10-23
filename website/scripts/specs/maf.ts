import { displayPainted } from '@jbrowse/browser-test-utils'

import { PARK_CURSOR, sessionSpec } from '../screenshot-spec-helpers.ts'
import { GRAPH_DRAWN, graphTrack, local } from './graph-fixtures.ts'
import { pageTrack } from './pageTrack.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

export const HG38_NCBI_GENE_TRACK = {
  type: 'FeatureTrack',
  trackId: 'ncbi_genes_hg38_ucsc',
  name: 'NCBI RefSeq (UCSC)',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'Gff3TabixAdapter',
    gffGzLocation: {
      uri: 'https://jbrowse.org/ucsc/hg38/hg38.gff.gz',
      locationType: 'UriLocation',
    },
    index: {
      location: {
        uri: 'https://jbrowse.org/ucsc/hg38/hg38.gff.gz.csi',
        locationType: 'UriLocation',
      },
      indexType: 'CSI',
    },
  },
}

// A local config: the jbrowse.org/demos/ce config loads the external
// mafviewer plugin, which shadows the built-in MAF display.
export const CE_MAF = 'test_data/ce_maf.json'

// Adds a `framesAdapter` built from UCSC multiz26wayFrames, which
// drives the CDS reading-frame overlay and codon view.
export const CE_MAF_FRAMES = 'test_data/ce_maf_frames.json'

export const HG38_470WAY = 'test_data/hg38_multiz470way.json'

// About 30 species across the mammalian clades, for `rows.kept`. Many
// leaf names in hg38.470way.nh carry an `HL` prefix.
export const HG38_470WAY_30 = [
  'hg38', // human
  'panTro6', // chimp
  'gorGor6', // gorilla
  'ponAbe3', // orangutan
  'rheMac10', // rhesus macaque
  'HLcalJac4', // marmoset
  'otoGar3', // bushbaby
  'mm39', // mouse
  'rn6', // rat
  'cavPor3', // guinea pig
  'hetGla2', // naked mole-rat
  'oryCun2', // rabbit
  'tupBel1', // tree shrew
  'bosTau9', // cow
  'HLoviAri5', // sheep
  'susScr11', // pig
  'vicPac2', // alpaca
  'turTru2', // dolphin
  'equCab3', // horse
  'cerSim1', // white rhino
  'felCat9', // cat
  'canFam4', // dog
  'ursMar1', // polar bear
  'myoLuc2', // little brown bat
  'eriEur2', // hedgehog
  'HLloxAfr4', // elephant
  'echTel2', // tenrec
  'oryAfe1', // aardvark
  'dasNov3', // armadillo
  'monDom5', // opossum
  'HLornAna3', // platypus
]

// The 470way config's refNameAliases map this chr-named bigBed onto the
// MAF's numeric refnames.
const HG38_MANE_TRACK = {
  type: 'FeatureTrack',
  trackId: 'mane_hg38',
  name: 'MANE Select 1.4 (NCBI RefSeq)',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BigBedAdapter',
    bigBedLocation: {
      uri: 'https://jbrowse.org/genomes/GRCh38/mane/MANE.GRCh38.v1.4.refseq.bb',
      locationType: 'UriLocation',
    },
  },
}

const CE11_GENE_TRACK = {
  type: 'FeatureTrack',
  trackId: 'ce11_ncbi_refseq',
  name: 'NCBI RefSeq genes (ce11)',
  assemblyNames: ['ce11'],
  adapter: {
    type: 'Gff3TabixAdapter',
    gffGzLocation: {
      uri: 'https://jbrowse.org/ucsc/ce11/ncbiRefSeqCurated.gff.gz',
      locationType: 'UriLocation',
    },
    index: {
      indexType: 'CSI',
      location: {
        uri: 'https://jbrowse.org/ucsc/ce11/ncbiRefSeqCurated.gff.gz.csi',
        locationType: 'UriLocation',
      },
    },
  },
}

// The first sixteen samples in callset order, both haplotypes each, plus
// the reference. parseAssemblyAndChr keeps the numeric second field of
// `HG00235.2.CM094400.1` with the genome, so a row is
// `<sample>.<haplotype>`.
const HPRC_MAF_ROWS = [
  'GRCh38',
  'CHM13.1',
  'CHM13.2',
  'HG00097.1',
  'HG00097.2',
  'HG00099.1',
  'HG00099.2',
  'HG00126.1',
  'HG00126.2',
  'HG00128.1',
  'HG00128.2',
  'HG00133.1',
  'HG00133.2',
  'HG00140.1',
  'HG00140.2',
  'HG00146.1',
  'HG00146.2',
  'HG002.1',
  'HG002.2',
  'HG00232.1',
  'HG00232.2',
  'HG00235.1',
  'HG00235.2',
  'HG00253.1',
  'HG00253.2',
  'HG00280.1',
  'HG00280.2',
  'HG00290.1',
  'HG00290.2',
  'HG00320.1',
  'HG00320.2',
  'HG00321.1',
  'HG00321.2',
]

// pangenome/hprc_graph_anatomy opens the same window; keep the two equal.
const HPRC_C4_LOCUS = 'chr6:31,980,000-32,050,000'

// CYP21A1P and TNXA: the span where several alignment rows have no
// sequence. C4A and C4B already carry labels in the gene lane.
const HPRC_C4_MARKED = 'chr6:32,005,691-32,011,057'

const HPRC_MAF_TRACK = pageTrack(
  'tutorials/pangenome_hprc.md',
  'hprc_v2_1_mc_grch38',
)

// The pgbi VCF holds one record per whole allele. The wave VCF draws this
// window blank: every record here nests under one parent (LV==0).
const HPRC_PGBI_ALLELES = ['jexl:alleleLength(feature)>=50']

export const mafSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'maf_track',
    url: sessionSpec(CE_MAF, {
      sessionTracks: [CE11_GENE_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'ce11',
          loc: 'chrI:2,997,000-3,003,000',
          tracks: [
            {
              trackId: 'ce11_ncbi_refseq',
              heightMode: 'grow',
            },
            {
              trackId: 'ce11.26way',
              rowHeight: 8,
              // The reference row draws one constant color under this color.
              alignments: { rowProportion: 0.9, reference: { show: false } },
            },
          ],
        },
      ],
    }),
    readyText: 'chrI',
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 640,
    tooltip: 'hide',
    actions: [PARK_CURSOR],
  },
  {
    mode: 'url',
    name: 'maf_codon_tooltip',
    tooltip: 'expect',
    url: sessionSpec(CE_MAF_FRAMES, {
      sessionTracks: [CE11_GENE_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'ce11',
          loc: 'chrI:2,999,200-2,999,370',
          trackLabels: 'offset',
          colorByFrame: true,
          tracks: [
            {
              trackId: 'ce11_ncbi_refseq',
              displayMode: 'compact',
              geneGlyphMode: 'longestCoding',
            },
            {
              trackId: 'ce11.26way',
              height: 470,
              encoding: { color: 'codon' },
            },
          ],
        },
      ],
    }),
    readyText: 'chrI',
    readyTimeout: 90000,
    viewportWidth: 1250,
    // Below 810 the frame clips the last species row.
    viewportHeight: 810,
    actions: [
      // caePb3's S -> L codon. The ce11 row is the reference, whose tooltip
      // reads "Change: none". dy 68 lands on the second species row: 16px
      // rows under a ~50px coverage band.
      {
        type: 'hover',
        anchor: {
          trackId: 'ce11.26way',
          loc: 'chrI:2,999,247',
          fracY: 0,
          dy: 68,
        },
      },
      { type: 'delay', ms: 2000 },
    ],
  },
  {
    mode: 'url',
    name: 'maf_color_by_chromosome',
    url: sessionSpec(CE_MAF_FRAMES, {
      sessionTracks: [CE11_GENE_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'ce11',
          loc: 'chrI:2,995,000-3,003,000',
          trackLabels: 'offset',
          tracks: [
            {
              trackId: 'ce11_ncbi_refseq',
              heightMode: 'grow',
            },
            {
              trackId: 'ce11.26way',
              rowHeight: 8,
              // The reference row draws one constant color under this color.
              alignments: { rowProportion: 0.9, reference: { show: false } },
              encoding: { color: 'chromosome' },
            },
          ],
        },
      ],
    }),
    readyText: 'chrI',
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 640,
    tooltip: 'hide',
    actions: [PARK_CURSOR],
  },
  {
    mode: 'url',
    name: 'maf_470way',
    url: sessionSpec(HG38_470WAY, {
      sessionTracks: [HG38_NCBI_GENE_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          // At 470 rows a whole-gene window reads as a wall; keep it to a few
          // exons, wide enough that a base is under a pixel and identity
          // draws rather than yielding to the bases.
          loc: '12:6,536,350-6,537,750',
          trackLabels: 'offset',
          tracks: [
            {
              trackId: 'ncbi_genes_hg38_ucsc',
              geneGlyphMode: 'longestCoding',
              filter: ['geneLike'],
            },
            {
              trackId: 'hg38.multiz470way',
              // rowHeight stays at its default 0, which fits every row into
              // this height.
              height: 600,
              encoding: { color: 'identity' },
            },
          ],
        },
      ],
    }),
    readyText: '6,53',
    readyTimeout: 120000,
    viewportWidth: 1100,
    viewportHeight: 940,
    tooltip: 'hide',
  },
  {
    mode: 'url',
    name: 'maf_470way_codon',
    url: sessionSpec(HG38_470WAY, {
      sessionTracks: [HG38_MANE_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          trackLabels: 'offset',
          colorByFrame: true,
          // Stays inside one GAPDH coding exon: past its 3' end, rows with no
          // aligned block draw empty bridge lines.
          loc: '12:6,536,485-6,536,590',
          tracks: [
            {
              trackId: 'mane_hg38',
              displayMode: 'compact',
              height: 40,
            },
            {
              trackId: 'hg38.multiz470way',
              height: 460,
              encoding: { color: 'codon' },
              conservation: { show: true, unit: 'codon' },
              rows: { kept: HG38_470WAY_30 },
            },
          ],
        },
      ],
    }),
    readyText: '6,536,5',
    readyTimeout: 120000,
    viewportWidth: 1000,
    viewportHeight: 765,
    tooltip: 'hide',
    actions: [PARK_CURSOR],
  },

  // One display spec at two zooms, so only the summary tier differs. A
  // compose has no annotation layer, so each part carries its own label.
  ...(
    [
      [
        'maf_summary_zoomed_out',
        // Must stay past the 20kb force-load floor, where `showSummary` takes
        // over.
        '12:6,450,000-6,630,000',
        'Zoomed out (180 kb): one bar per species, from the summary file',
      ],
      [
        'maf_summary_zoomed_in',
        '12:6,537,000-6,537,200',
        'Zoomed in (200 bp): the alignment itself, one cell per base',
      ],
    ] as const
  ).map(([name, loc, label]): ScreenshotSpec => ({
    mode: 'url' as const,
    name,
    url: sessionSpec(HG38_470WAY, {
      sessionTracks: [HG38_NCBI_GENE_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc,
          trackLabels: 'offset',
          tracks: [
            {
              trackId: 'ncbi_genes_hg38_ucsc',
              geneGlyphMode: 'longestCoding',
              filter: ['geneLike'],
            },
            {
              trackId: 'hg38.multiz470way',
              height: 380,
              rows: { kept: HG38_470WAY_30 },
              // Both halves exceed the byte gate: the alignment at 200bp, the
              // summary file at 180kb. The gate banner would replace the figure.
              forceLoad: true,
            },
          ],
        },
      ],
    }),
    readyText: '12',
    readyTimeout: 120000,
    viewportWidth: 780,
    viewportHeight: 745,
    tooltip: 'hide',
    annotations: [
      {
        type: 'text' as const,
        text: label,
        fontSize: 20,
        anchor: {
          trackId: 'hg38.multiz470way',
          alignX: 'left' as const,
          alignY: 'bottom' as const,
        },
        dx: 220,
        dy: -26,
      },
    ],
  })),
  {
    mode: 'compose',
    name: 'maf_summary_tier',
    columns: 2,
    parts: ['maf_summary_zoomed_out', 'maf_summary_zoomed_in'],
  },

  // HPRC release 2.1's minigraph-cactus MAF, read remotely. v2.0's TAF is
  // cheaper but predates the v2.1 graph and callsets on this page.
  //
  // The window, the README's C4 module, fetches 3.50 MB against the 5 MB
  // default; past ~123 kb of view the MAF exceeds it. Narrowing it drops
  // C4B, and the caption is about copy number across C4A and C4B.
  //
  // The UCSC NCBI RefSeq GFF3 names genes by symbol; the MANE bigBed names
  // them by NM_ accession. The `geneLike` filter keeps its many recombination
  // and enhancer regions out of the lane.
  {
    mode: 'url' as const,
    name: 'maf_hprc_pangenome',
    url: sessionSpec(local('test_data/graphgenomeview/hprc.json'), {
      sessionTracks: [HG38_NCBI_GENE_TRACK, HPRC_MAF_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: HPRC_C4_LOCUS,
          highlight: [HPRC_C4_MARKED],
          tracks: [
            {
              trackId: 'ncbi_genes_hg38_ucsc',
              filter: ['geneLike'],
              geneGlyphMode: 'longestCoding',
              heightMode: 'grow',
            },
            {
              trackId: 'hprc2_pgbi_grch38',
              variants: { show: true },
              height: 240,
              filter: HPRC_PGBI_ALLELES,
              runClustering: true,
            },
            {
              trackId: 'hprc_v2_1_mc_grch38',
              // A row label needs 6 px (SvgRowLabels' MIN_TEXT_ROW_HEIGHT), so
              // the figure draws a named subset. The focus drops every row it
              // does not name, the reference included. No CHM13 row exists
              // under that name in this file.
              rows: { kept: HPRC_MAF_ROWS },
              // Leaves the 31 rows about 15 px each after the bands.
              height: 530,
              runClustering: true,
              // Most distances here are zero, so a phylogram collapses the
              // branches against the rows.
              showBranchLength: false,
              alignments: { rowProportion: 1 },
            },
            graphTrack('hprc_minigraph_segments', {
              layoutMode: 'force',
              paneHeight: 600,
              color: { field: 'position' },
              layers: { bubbles: false },
            }),
          ],
        },
      ],
    }),
    viewportHeight: 1850,
    readySelector: GRAPH_DRAWN,
    readyTimeout: 360000,
    // One wait per display: a body-level `:has` cannot say which lane drew
    // its dendrogram.
    actions: [
      {
        type: 'waitForSelector' as const,
        selector: `${displayPainted('variant-display')}[data-clustered="true"]`,
        timeout: 240000,
      },
      {
        type: 'waitForSelector' as const,
        selector: `${displayPainted('maf-display')}[data-clustered="true"]`,
        timeout: 240000,
      },
    ],
    // s329764+ is the v2.1 node under the band, found with
    // `probe-graph-nodes.ts`; re-probe after a release change.
    annotations: [
      {
        type: 'text' as const,
        text: 'Grey: aligned to GRCh38\nWhite: no aligned sequence for that haplotype',
        fontSize: 18,
        maxWidth: 380,
        // End-aligned so the pill stays inside the frame.
        textAlign: 'end' as const,
        anchor: {
          trackId: 'hprc_v2_1_mc_grch38',
          loc: 'chr6:32,049,000',
          fracY: 0.12,
        },
      },
      {
        type: 'circle' as const,
        anchor: { graphNode: 's329764+' },
        radius: 26,
        strokeWidth: 3,
        // Near-black loses against the charcoal off-reference nodes beside
        // the ring; the default red does not.
      },
      {
        type: 'arrow' as const,
        fromAnchor: {
          view: 0,
          trackId: 'hprc_v2_1_mc_grch38',
          loc: HPRC_C4_MARKED,
          fracY: 1,
          dy: -8,
        },
        // Offset by the radius: a node anchor resolves to the node's centre.
        anchor: { graphNode: 's329764+', dx: -30, dy: -30 },
        strokeWidth: 3,
      },
    ],
  },
]
