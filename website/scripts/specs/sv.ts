import { displayPainted } from '@jbrowse/browser-test-utils'

import {
  DEMO_CONFIG,
  HG00151_ONT_1000G_ADAPTER,
  HG002_NANOPORE_HP_TRACK,
  PARK_CURSOR,
  VOLVOX,
  lgvSession,
  sessionSpec,
  CGIAB_CONFIG,
  KG_CONFIG,
} from '../screenshot-spec-helpers.ts'
import { junctionReads } from './cgiab-junction.ts'
import { pageTrack } from './pageTrack.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// A track as the C-GIAB SV page (or its copy-number part 2) prints it, with its
// bare filenames read from where the demo hosts them.
const cgiabPageTrack = (trackId: string, page: 'sv' | 'cnv' = 'sv') =>
  pageTrack(
    page === 'sv'
      ? 'tutorials/sv_visualization_cgiab.md'
      : 'tutorials/cnv_cgiab.md',
    trackId,
    { base: 'https://jbrowse.org/demos/cgiab' },
  )

// A rehosted slice of the 118 GB NCBI BAM, covering the SV_20 windows (chr3 /
// chr13) and CDKN2A (chr9) only. build_demo_slices.sh cuts each wider than the
// widest window that draws it; a narrower cut shows depth falling off.
export const HG008_T_PACBIO_BAM =
  'https://jbrowse.org/demos/cgiab/HG008-T_PacBio-HiFi-Revio_116x.demo_slices.bam'

const CGIAB_FTP_READS =
  'https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/PacBio_Revio_20240125'

// BAF is unfolded over germline het sites (baf_bcftools.sh). HiFiCNV's own
// maf.bw folds to min(AF, 1-AF), collapsing an LOH arm onto one band near 0.
//
// resolutionMultiplier 0.001 keeps the fetch on raw per-site values out to
// ~1.28 Mbp/px; a bigWig zoom summary over an LOH arm is min 0, max 1 and
// paints a full-height wash. Whole-genome views still summarize.
export const HG008_DEPTH_TRACK = {
  type: 'QuantitativeTrack',
  trackId: 'hg008_depth',
  name: 'HG008-T HiFiCNV depth',
  assemblyNames: ['GRCh38_GIABv3'],
  adapter: {
    type: 'BigWigAdapter',
    bigWigLocation: {
      uri: 'https://jbrowse.org/demos/cgiab/HG008-T.hificnv.depth.bw',
      locationType: 'UriLocation',
    },
  },
}
// BIC-seq2's published tumour-vs-normal log2 copy ratio. The baseline sits at
// +0.44 because HG008-T is hypodiploid and BIC-seq2 normalizes on total read
// count; the figures read the steps.
const HG008_BICSEQ2_TRACK = cgiabPageTrack('hg008t_bicseq2', 'cnv')

export const HG008_BAF_TRACK = {
  type: 'QuantitativeTrack',
  trackId: 'hg008_baf',
  name: 'HG008-T B-allele frequency (BAF)',
  assemblyNames: ['GRCh38_GIABv3'],
  adapter: {
    type: 'BigWigAdapter',
    bigWigLocation: {
      uri: 'https://jbrowse.org/demos/cgiab/HG008-T_baf.bcftools.bw',
      locationType: 'UriLocation',
    },
    resolutionMultiplier: 0.001,
  },
}

// goleft indexcov normalizes each sample to its own median, so the normal sits
// at 1.0 and tumour levels read as ratios against it. Shared so every figure
// mounts the same two files.
export const HG008_INDEXCOV_TRACK = {
  type: 'MultiQuantitativeTrack',
  trackId: 'hg008_cnv_indexcov',
  name: 'HG008 normal vs tumor coverage (indexcov)',
  assemblyNames: ['GRCh38_GIABv3'],
  adapter: {
    type: 'MultiWiggleAdapter',
    subadapters: [
      {
        name: 'HG008-N (normal)',
        type: 'BigWigAdapter',
        bigWigLocation: {
          uri: 'https://jbrowse.org/demos/cgiab/HG008-N_indexcov.bw',
          locationType: 'UriLocation',
        },
      },
      {
        name: 'HG008-T (tumor)',
        type: 'BigWigAdapter',
        bigWigLocation: {
          uri: 'https://jbrowse.org/demos/cgiab/HG008-T_indexcov.bw',
          locationType: 'UriLocation',
        },
      },
    ],
  },
}

// A one-gene lane from MANE Select 1.4. The config's RefSeq track is too heavy
// to fetch whole-chromosome inside a capture.
//
// The filter matches the transcript accession in `name`; filtering on the
// symbol leaves the lane empty. `forceLoad` because the density gate runs
// before any filter. Read accessions out of the hosted bigBed:
//   bigBedToBed MANE.GRCh38.v1.4.refseq.bb -chrom=chr12 -start=25200000 \
//     -end=25260000 stdout   ->   NM_004985.5  chr12:25,205,245-25,250,929
function maneGeneLane({
  symbol,
  accession,
  height = 50,
  // The gene's own span; resolveFeatureHighlights matches within +/-1 bp.
  featureHighlights,
}: {
  symbol: string
  accession: string
  height?: number
  featureHighlights?: {
    refName: string
    start: number
    end: number
    name: string
  }[]
}) {
  const trackId = 'mane_hg38'
  return {
    track: {
      type: 'FeatureTrack',
      trackId,
      name: `${symbol} (MANE Select, NCBI RefSeq 1.4)`,
      assemblyNames: ['GRCh38_GIABv3'],
      adapter: {
        type: 'BigBedAdapter',
        bigBedLocation: {
          uri: 'https://jbrowse.org/genomes/GRCh38/mane/MANE.GRCh38.v1.4.refseq.bb',
          locationType: 'UriLocation',
        },
      },
      // `name` is the accession; the symbol is the bigBed's `geneSymbol`
      // column.
      displays: [
        {
          type: 'LinearBasicDisplay',
          displayId: `${trackId}-LinearBasicDisplay`,
          labels: { name: "jexl:get(feature,'geneSymbol')" },
        },
      ],
    },
    lane: {
      trackId,
      filter: [`jexl:get(feature,'name')=='${accession}'`],
      forceLoad: true,
      height,
      ...(featureHighlights ? { featureHighlights } : {}),
    },
  }
}

const TP53_MANE = maneGeneLane({ symbol: 'TP53', accession: 'NM_000546.6' })

const KRAS_MANE = maneGeneLane({
  symbol: 'KRAS',
  accession: 'NM_004985.5',
  featureHighlights: [
    { refName: 'chr12', start: 25205245, end: 25250929, name: 'KRAS' },
  ],
})

// Boxed because this figure is the whole of chr18 and SMAD4 is 55 kb of it.
const SMAD4_MANE = maneGeneLane({
  symbol: 'SMAD4',
  accession: 'NM_005359.6',
  featureHighlights: [
    { refName: 'chr18', start: 51030212, end: 51085042, name: 'SMAD4' },
  ],
})

// SV_85's span as the SV inspector's location column prints it, so one string
// finds the spreadsheet cell and (parseAnnotationLocus accepts `..`) the glyph.
const SV_85_DEL = 'chr10:122,835,344..122,837,142'

const CLINVAR_CNV_TRACK = cgiabPageTrack('hg38_clinvar_cnv_ucsc')

// The origin for inverted_duplication's callouts: the pileup's top edge at the
// view's left. The arc band is 2000px, so a fraction of the track height means
// nothing here.
const INVDUP_PILEUP = {
  trackId: 'HG02768.final',
  loc: '1:39,658,200',
  fracY: 0,
}

// hg19 main chromosomes; whole-genome showAllRegionsInAssembly also appends the
// _hap / _random / Un contigs as a cluttered final block.
const HG19_MAIN_CHROMS = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
  '20',
  '21',
  '22',
  'X',
  'Y',
]
// At 90 px the axis draws only its two extremes.
const HG008_BICSEQ2_LANE = {
  trackId: HG008_BICSEQ2_TRACK.trackId,
  height: 130,
}

// The subclonal lane's palette, so the page's two copy-number lanes read alike.
const BENCHMARK_CNV_COLOR = {
  field: 'total_copy_number',
  scale: 'threshold',
  domain: [1, 2, 3, 4],
  range: ['#2166ac', '#92c5de', '#e0e0e0', '#f4a582', '#b2182b'],
  labels: ['CN 0', 'CN 1', 'CN 2', 'CN 3', 'CN 4+'],
  title: 'Copy number',
}
// Below 120 px the key clips CN 4+.
const benchmarkCnvLane = (trackId = 'hg008t_somatic_cnv') => ({
  trackId,
  color: BENCHMARK_CNV_COLOR,
  height: 120,
})

// The file user_guides/sv_inspector_view.md tells the reader to paste.
const SKBR3_SNIFFLES_VCF =
  'https://jbrowse.org/genomes/hg19/SKBR3/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.sniffles1kb_auto_l8_s5_noalt.filtered.vcf.gz'

export const svVideoFixtures = {
  emptySession: sessionSpec(DEMO_CONFIG, { views: [] }),
  callsetUrl: SKBR3_SNIFFLES_VCF,
  assembly: 'hg19',
}

// videos/sv.ts films the indexcov lane with no display settings, as a reader
// first loads it; the cgiab figures already apply the walkthrough's settings.
// chr5 carries three allelic states, so the payoff frame has levels to read.
export const cgiabVideoFixtures = {
  coverageTrackId: 'hg008_cnv_indexcov',
  coverageAsLoaded: sessionSpec(CGIAB_CONFIG, {
    sessionTracks: [HG008_INDEXCOV_TRACK],
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'GRCh38_GIABv3',
        loc: 'chr5',
        tracks: [
          {
            trackId: 'hg008_cnv_indexcov',
            height: 200,
          },
        ],
      },
    ],
  }),
}

// The chord track arrives last; the 'CHROM' column header paints before the
// sheet has rows.
const CHORDS_DRAWN =
  '[data-testid="structuralVariantChordRenderer"]:not([data-chord-count="0"])'

export const svSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'sv_inspector_importform_loaded',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'SvInspectorView',
          assembly: 'hg19',
          uri: SKBR3_SNIFFLES_VCF,
        },
      ],
    }),
    readySelector: CHORDS_DRAWN,
    readyTimeout: 60000,
    viewportHeight: 615,
  },

  // "X" matches the Mate column too, so the filter keeps calls touching chrX at
  // either end.
  {
    mode: 'url',
    name: 'sv_inspector_importform_filtered',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'SvInspectorView',
          assembly: 'hg19',
          uri: SKBR3_SNIFFLES_VCF,
        },
      ],
    }),
    readySelector: CHORDS_DRAWN,
    readyTimeout: 60000,
    actions: [
      {
        type: 'type',
        selector: 'input[placeholder^="Search"]',
        value: 'X',
        clear: true,
      },
      { type: 'delay', ms: 4000 },
    ],
    viewportHeight: 615,
  },

  {
    mode: 'url',
    name: 'horizontally_flip_before',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr7:5,562,000-5,575,000',
      tracks: [
        {
          trackId: 'ncbi_gff_hg19',
          geneGlyphMode: 'longestCoding',
        },
      ],
    }),
    readyText: 'ACTB',
    readyTimeout: 60000,
    crop: { x: 0, y: 0, width: 1500, height: 300 },
    annotations: [
      { type: 'text', x: 20, y: 30, fontSize: 22, text: 'Normal orientation' },
    ],
  },
  {
    mode: 'url',
    name: 'horizontally_flip_after',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr7:5,562,000-5,575,000[rev]',
      tracks: [
        {
          trackId: 'ncbi_gff_hg19',
          geneGlyphMode: 'longestCoding',
        },
      ],
    }),
    readyText: 'ACTB',
    readyTimeout: 60000,
    crop: { x: 0, y: 0, width: 1500, height: 300 },
    annotations: [
      {
        type: 'text',
        x: 20,
        y: 30,
        fontSize: 22,
        text: 'Horizontally flipped ([rev] locstring)',
      },
    ],
  },
  {
    mode: 'compose',
    name: 'horizontally_flip',
    parts: ['horizontally_flip_before', 'horizontally_flip_after'],
  },

  {
    mode: 'url',
    name: 'cnv',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [
        {
          type: 'MultiQuantitativeTrack',
          trackId: 'colo829_cnv_coverage',
          name: 'COLO829 tumor/normal coverage',
          assemblyNames: ['hg19'],
          adapter: {
            type: 'MultiWiggleAdapter',
            subadapters: [
              {
                type: 'BigWigAdapter',
                source: 'COLO829 tumor',
                // Pinned colors: multiwig source colors follow post-filter
                // index.
                color: '#e41a1c',
                bigWigLocation: {
                  uri: 'https://jbrowse.org/genomes/hg19/COLO829/colo_tumor.bw',
                  locationType: 'UriLocation',
                },
              },
              {
                type: 'BigWigAdapter',
                source: 'COLO829 normal',
                color: '#377eb8',
                bigWigLocation: {
                  uri: 'https://jbrowse.org/genomes/hg19/COLO829/colo_normal.bw',
                  locationType: 'UriLocation',
                },
              },
            ],
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          displayedRegionNames: HG19_MAIN_CHROMS,
          tracks: [
            {
              trackId: 'colo829_cnv_coverage',
              mark: 'point',
              rows: '',
              // BigWig zoom levels are discrete, so a lower resolution may not
              // add detail.
              resolution: 50,
              size: 1,
              // Pinned: the outlier fence leaves a spike half the axis and
              // flattens the steps.
              scales: { y: { domainMin: 0, domainMax: 100 } },
            },
          ],
        },
      ],
    }),
    readyText: 'COLO829',
    // The heaviest fetch in the corpus; at 60s the app marker had not flipped.
    readyTimeout: 180000,
    crop: { x: 0, y: 0, width: 1500, height: 390 },
    // The dense scatter drifts a fraction of a percent between identical runs.
    diffThreshold: 0.03,
  },

  // HG002's 27bp heterozygous deletion sits in one haplotype, so faceting on HP
  // shows it in one group. The HP colors come from TAG_COLOR_PALETTE
  // (colorTagUtils.ts).
  {
    mode: 'url',
    name: 'smalldel',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [HG002_NANOPORE_HP_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: '1:63,005,675-63,007,432',
          tracks: [
            'variants_hg002',
            {
              trackId: 'hg002_nanopore_hp',
              height: 400,
              forceLoad: true,
              facet: 'tags.HP',
              color: { field: 'tags.HP' },
            },
          ],
        },
      ],
    }),
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 90000,
    viewportHeight: 1000,
  },

  // A breakpoint where the reads clip hard at one column, so the clip-indicator
  // stack is tall.
  {
    mode: 'url',
    name: 'alignment_clipping_indicators',
    viewportHeight: 497,
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:2,560-2,760',
      tracks: [
        {
          trackId: 'volvox-long-reads-sv-bam',
          coverage: {
            height: 120,
          },
        },
      ],
    }),
    readyText: 'ctgA',
    readyTimeout: 60000,
  },

  {
    mode: 'url',
    name: 'inverted_duplication',
    url: sessionSpec(KG_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: '1:39,658,200-39,661,800',
          trackLabels: 'offset',
          // No highlight: the 228 bp dup half is what the read orientations say
          // nothing about. The tutorial points at INFO.CPX_INTERVALS for it.
          tracks: [
            '1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf',
            {
              trackId: 'HG02768.final',
              unit: 'chain',
              readConnections: {
                show: true,
                placement: 'down',
                // An arc's apex height is its genomic span in px, clamped to
                // the band. At 40 every concordant arc hit the ceiling and the
                // band was one solid mass.
                height: 200,
              },
              coverage: { height: 120 },
              pileup: { readHeight: 3 },
              // At 1px the discordant cluster loses its color. 'grow' because
              // the discordant reads land at the bottom of the layout, where a
              // short track scrolls them away.
              heightMode: 'grow',
              color: { field: 'pairOrientation' },
              showLegend: true,
            },
          ],
        },
      ],
    }),
    readyText: 'HG02768',
    readyTimeout: 60000,
    // The feature-details drawer runs to the bottom of any frame, so neither
    // size report can set this; 1075 is where the app frame ends.
    viewportHeight: 1075,
    // PARK_CURSOR clears the hover wash the display draws; `tooltip: 'hide'`
    // cannot reach it.
    actions: [
      {
        type: 'click',
        selector: '[data-testid="feature-name-HGSV_2721"]',
      },
      { type: 'waitForText', text: 'CPX_TYPE' },
      PARK_CURSOR,
    ],
    // A newline in `text` is a hard break and a wrapped bullet does not
    // hang-indent, so each bullet must fit `maxWidth` on one line.
    annotations: [
      {
        type: 'text',
        // In off the track's left edge, so the app frame does not clip the
        // border.
        anchor: { ...INVDUP_PILEUP, dx: 50, dy: 360 },
        // LL/RR are the palette's own labels (colorPairLL / colorPairRR);
        // magenta is colorSplitReadInversion.
        text: 'INVdup\n\n• Green = LL pair: both mates on the forward strand\n• Navy = RR pair: both mates on the reverse strand\n• Magenta = split read: SA segment on the opposite strand',
        fontSize: 24,
        maxWidth: 920,
      },
    ],
  },

  // The same INVdup with one band per pair orientation. The settings are
  // SV_CHANNELS_ON (svChannelsPreset.ts) verbatim; `readConnectionsDown` and
  // the heights are this figure's own.
  {
    mode: 'url',
    name: 'sv_channels',
    url: sessionSpec(KG_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: '1:39,658,200-39,661,800',
          trackLabels: 'offset',
          tracks: [
            '1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf',
            {
              trackId: 'HG02768.final',
              pileup: { show: false },
              readConnections: {
                show: true,
                placement: 'down',
                ordinaryPairs: { show: false },
                height: 90,
              },
              coverage: { height: 60 },
              facet: 'pairOrientation',
              showLegend: true,
              // The five bands' own stack. A taller box pads the frame from
              // inside, which neither size report sees.
              height: 800,
            },
          ],
        },
      ],
    }),
    readyText: 'HG02768',
    readyTimeout: 60000,
    // A shorter frame drops the LL band and the "No orientation" band under it.
    viewportHeight: 1150,
  },

  // The long-read half of inversion pair evidence: HG00151 ONT reads span the
  // whole ~1.2 kb HGSV_10047 inversion and split into forward + reverse
  // segments. HG00151_ONT_1000G_ADAPTER keeps the supplementary alignments.
  {
    mode: 'url',
    name: 'inversion_long_read',
    url: sessionSpec(KG_CONFIG, {
      sessionTracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'HG00151_ONT_1000g',
          name: 'HG00151 Nanopore (1000G ONT, minimap2)',
          assemblyNames: ['hg38'],
          adapter: HG00151_ONT_1000G_ADAPTER,
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: '1:197,785,500-197,791,000',
          tracks: [
            '1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf',
            {
              trackId: 'HG00151_ONT_1000g',
              unit: 'chain',
              readConnections: {
                show: true,
                // One ~1.2 kb dome; at 130 the arc dwarfed the reads.
                height: 60,
              },
              // Drops these reads' cross-chromosome and far-flank
              // supplementaries, leaving the local inversion arc.
              filter: [
                { field: 'connection.interchrom', equal: false },
                { field: 'connection.offscreen', equal: false },
              ],
              coverage: { height: 70 },
              // The "Not split" section runs out of rows before a taller box
              // does.
              height: 620,
              color: { field: 'pairOrientation' },
              showLegend: true,
              // `facet: 'split'` works in chain mode because split defines a
              // chain key.
              facet: 'split',
            },
          ],
        },
      ],
    }),
    readyText: 'HG00151 Nanopore',
    readyTimeout: 90000,
    // One frame: the session already sets `facet: split`, so a menu frame
    // would show the same picture.
    viewportWidth: 1400,
    // Holds the whole grouped track, including the second section's coverage
    // lane.
    viewportHeight: 966,
    tooltip: 'hide',
    actions: [PARK_CURSOR],
    // The section pills anchor on the divider labels with `alignX: 'right'`;
    // `dy` drops each onto its 70 px coverage lane, since a pill centred on the
    // divider covers the track header.
    annotations: [
      {
        type: 'text',
        text: 'Group by → Split read (SA tag)',
        fontSize: 18,
        anchor: { text: 'HG00151 Nanopore', alignX: 'right', dx: 16 },
      },
      {
        type: 'text',
        text: 'Split reads with SA tag — most showing INV',
        fontSize: 18,
        maxWidth: 560,
        anchor: { text: 'Split (SA)', alignX: 'right', dx: 14, dy: 45 },
      },
      {
        type: 'text',
        text: 'Reads without SA tag',
        fontSize: 18,
        maxWidth: 560,
        anchor: { text: 'Not split', alignX: 'right', dx: 14, dy: 45 },
      },
    ],
  },

  {
    mode: 'url',
    name: 'sv_cgiab/translocation_sv_inspector_start',
    url: sessionSpec(CGIAB_CONFIG, { views: [] }),
    readyText: 'Select a view to launch',
    readyTimeout: 60000,
    crop: { x: 0, y: 0, width: 1500, height: 460 },
    actions: [
      { type: 'click', text: 'Add' },
      { type: 'waitForText', text: 'SV inspector' },
    ],
    annotations: [
      { type: 'box', anchor: { text: 'Add' } },
      { type: 'box', anchor: { text: 'SV inspector' } },
    ],
  },

  {
    mode: 'url',
    name: 'sv_cgiab/translocation_sv_inspector_view',
    url: sessionSpec(CGIAB_CONFIG, {
      views: [
        {
          type: 'SvInspectorView',
          assembly: 'GRCh38_GIABv3',
          uri: 'https://jbrowse.org/genomes/GRCh38/cgiab/GRCh38_HG008-T-V0.5_somatic-stvar_PASS.draftbenchmark.vcf.gz',
          // SV_20 is row 27, past the DataGrid's virtualization buffer at the
          // default height, so the hover below cannot find it without this.
          height: 1000,
        },
      ],
    }),
    readyText: 'chr1',
    readyTimeout: 60000,
    // Holds the whole 1000px view; a shorter frame lets the hover scroll the
    // page.
    viewportHeight: 1065,
    clicksChange: 'scroll the table to SV_20',
    // The hover scrolls SV_20 into the grid's viewport before the box is
    // measured. The anchor is the grid row: SV_190 draws the same junction's
    // chord over SV_20's end to end (`node scripts/probe-chords.ts <spec>
    // --click=SV_20`).
    actions: [{ type: 'hover', text: 'SV_20' }],
    annotations: [
      { type: 'box', anchor: { text: 'SV_20' } },
      {
        type: 'text',
        text: 'SV_20: the chr3↔chr13 translocation, drilled into below.',
        maxWidth: 420,
        anchor: { text: 'SV_20', alignX: 'left', alignY: 'top' },
        dy: -54,
      },
    ],
  },

  junctionReads('sv_cgiab/translocation_breakpoint_split'),

  // Five somatic SV callsets over the two cluster_3 breakends (SV_20, SV_21)
  // with the HiFiCNV depth halving between them. The benchmark CNV lane's CN 2
  // segment across the window is the negative.
  //
  // Labels stay on the benchmark lane alone: the caller lanes' ids overlap at
  // this width.
  {
    mode: 'url',
    name: 'sv_cgiab/sv_callset_comparison',
    url: sessionSpec(CGIAB_CONFIG, {
      sessionTracks: [
        HG008_DEPTH_TRACK,
        cgiabPageTrack('hg008t_severus_sv'),
        cgiabPageTrack('hg008t_minda_sv'),
        cgiabPageTrack('hg008t_dragen_sv'),
        cgiabPageTrack('hg008t_nygc_sv'),
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          loc: 'chr3:139,970,000-140,005,000',
          trackLabels: 'offset',
          tracks: [
            {
              trackId: 'hg008t_benchmark_sv',
              height: 55,
            },
            {
              trackId: 'hg008t_severus_sv',
              showLabels: 'none',
              height: 45,
            },
            {
              trackId: 'hg008t_minda_sv',
              showLabels: 'none',
              height: 45,
            },
            {
              trackId: 'hg008t_dragen_sv',
              showLabels: 'none',
              height: 45,
            },
            {
              trackId: 'hg008t_nygc_sv',
              height: 45,
            },
            {
              // Bars on a fixed axis: 2 kb bins put ~17 points across this
              // window.
              trackId: 'hg008_depth',
              mark: 'bar',
              color: '#0068d1',
              extent: 'none',
              scales: { y: { domainMin: 0, domainMax: 140, grid: true } },
              height: 180,
            },
            benchmarkCnvLane(),
          ],
        },
      ],
    }),
    readyText: 'chr3',
    readyTimeout: 180000,
    viewportWidth: 1500,
    viewportHeight: 984,
  },

  {
    mode: 'url',
    name: 'sv_cgiab/deletion_sv_inspector_search',
    viewportHeight: 990,
    url: sessionSpec(CGIAB_CONFIG, {
      sessionTracks: [CLINVAR_CNV_TRACK],
      views: [
        {
          type: 'SvInspectorView',
          assembly: 'GRCh38_GIABv3',
          height: 420,
          uri: 'https://jbrowse.org/genomes/GRCh38/cgiab/GRCh38_HG008-T-V0.5_somatic-stvar_PASS.draftbenchmark.vcf.gz',
          filterText: 'SV_85',
        },
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          loc: 'chr10:122,823,828-122,852,611',
          tracks: [
            'hg38_ncbiRefSeq_ucsc',
            // `_varLen < 50000` drops the chromosome-scale ClinVar losses that
            // merely contain this 1.8 kb deletion; unfiltered, the lane is one
            // red bar across the window.
            {
              trackId: CLINVAR_CNV_TRACK.trackId,
              heightMode: 'grow',
            },
            {
              trackId: 'hg008t_benchmark_sv',
              // featureHighlights boxes the glyph wherever the display laid it
              // out. It matches by name because SV_85_DEL is 1-based display
              // text, and a span must agree with the record to within a base.
              featureHighlights: [{ refName: 'chr10', name: 'SV_85' }],
            },
          ],
        },
      ],
    }),
    // The LGV location is an input value, not matchable text.
    readyText: 'chr1',
    // The ClinVar bigBed and the inspector's VCF are both remote.
    readyTimeout: 120000,
    annotations: [
      {
        type: 'text',
        text: 'search SV_85',
        anchor: {
          text: SV_85_DEL,
          alignX: 'left',
          alignY: 'top',
          dx: 22,
          dy: -40,
        },
        fontSize: 18,
        maxWidth: 420,
      },
      { type: 'box', anchor: { text: SV_85_DEL } },
      {
        type: 'arrow',
        fromAnchor: { text: SV_85_DEL, dy: 30 },
        anchor: {
          view: 1,
          trackId: 'hg008t_benchmark_sv',
          loc: SV_85_DEL,
          fracY: 0,
          dy: 14,
        },
      },
      {
        type: 'text',
        text: 'opens here',
        anchor: {
          view: 1,
          trackId: 'hg008t_benchmark_sv',
          loc: SV_85_DEL,
          fracY: 0,
          alignX: 'right',
          dx: 50,
          dy: 28,
        },
        fontSize: 18,
        maxWidth: 360,
      },
    ],
  },

  {
    mode: 'url',
    name: 'sv_cgiab/deletion_linear_view',
    url: sessionSpec(CGIAB_CONFIG, {
      sessionTracks: [
        // A 2.8 MB slice of the 116x tumour BAM; the full BAM trips the
        // force-load gate over this window.
        {
          type: 'AlignmentsTrack',
          trackId: 'hg008t_pacbio_chr10_deletion_slice',
          name: 'HG008-T PacBio HiFi (116x, chr10 slice)',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: 'https://jbrowse.org/demos/cgiab/HG008-T_chr10_CUZD1_deletion.bam',
              locationType: 'UriLocation',
            },
            index: {
              location: {
                uri: 'https://jbrowse.org/demos/cgiab/HG008-T_chr10_CUZD1_deletion.bam.bai',
                locationType: 'UriLocation',
              },
              indexType: 'BAI',
            },
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          loc: 'chr10:122,822,042-122,850,825',
          showCenterLine: true,
          tracks: [
            'hg38_ncbiRefSeq_ucsc',
            'hg008t_benchmark_sv',
            {
              trackId: 'hg008t_pacbio_chr10_deletion_slice',
              height: 300,
              pileup: { readHeight: 3 },
              sort: {
                field: 'base',
                pos: 122836434,
                refName: 'chr10',
              },
            },
          ],
        },
      ],
    }),
    readyText: 'chr10',
    readyTimeout: 60000,
  },

  // SV_223, the V0.5 README's worked tandem-repeat example: an insertion in the
  // normal and a deletion in the tumour against GRCh38.
  //
  // The published BAMs: the HG008_T_PACBIO_BAM slice has no reads here.
  {
    mode: 'url',
    name: 'sv_cgiab/vntr_tumor_normal',
    url: sessionSpec(CGIAB_CONFIG, {
      sessionTracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'hg008t_pacbio_full',
          name: 'HG008-T PacBio HiFi (116x, published BAM)',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: `${CGIAB_FTP_READS}/HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3.bam`,
              locationType: 'UriLocation',
            },
            index: {
              location: {
                uri: `${CGIAB_FTP_READS}/HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3.bam.bai`,
                locationType: 'UriLocation',
              },
              indexType: 'BAI',
            },
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          loc: 'chr5:165,755,030-165,755,270',
          // No center line: its coordinate chip draws over the normal's pileup.
          tracks: [
            'GRCh38_GIABv3-ReferenceSequenceTrack',
            {
              trackId: 'hg008t_benchmark_sv',
              height: 60,
            },
            // Both sorted at a column inside the deleted span.
            {
              trackId: 'hg008t_pacbio_full',
              height: 260,
              pileup: { readHeight: 5 },
              forceLoad: true,
              sort: {
                field: 'base',
                pos: 165755150,
                refName: 'chr5',
              },
            },
            {
              trackId: 'HG008-N-P_PacBio-HiFi-Revio_20240125_35x_GRCh38-GIABv3',
              height: 260,
              pileup: { readHeight: 5 },
              forceLoad: true,
              sort: {
                field: 'base',
                pos: 165755150,
                refName: 'chr5',
              },
            },
          ],
        },
      ],
    }),
    readyText: 'chr5',
    readyTimeout: 180000,
    viewportHeight: 1020,
  },

  {
    mode: 'url',
    name: 'sv_cgiab/cnv_with_bed_track',
    // The indexcov lane reads as copy number (median 1). chr5 carries three
    // allelic states, so the BAF lane shows one band, a gain's pair and LOH's
    // two.
    url: sessionSpec(CGIAB_CONFIG, {
      sessionTracks: [
        HG008_BICSEQ2_TRACK,
        HG008_BAF_TRACK,
        HG008_INDEXCOV_TRACK,
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          loc: 'chr5',
          trackLabels: 'offset',
          tracks: [
            HG008_BICSEQ2_LANE,
            {
              trackId: 'hg008_cnv_indexcov',
              mark: 'point',
              rows: '',
              // indexcov's centromere and repeat spikes run to 497; an
              // autoscaled axis merges the three tumour levels into one cloud.
              scales: { y: { domainMin: 0, domainMax: 3, grid: true } },
              resolution: 8,
              height: 200,
            },
            {
              trackId: 'hg008_baf',
              // Points, since a line averages the two LOH bands into 0.5.
              mark: 'point',
              size: 1,
              scales: { y: { domainMin: 0, domainMax: 1 } },
              height: 140,
            },
            benchmarkCnvLane(),
          ],
        },
      ],
    }),
    readyText: 'chr5',
    readyTimeout: 60000,
    viewportWidth: 1800,
    viewportHeight: 922,
    annotations: [
      {
        type: 'text',
        text: 'two copies',
        maxWidth: 600,
        fontSize: 18,
        anchor: {
          trackId: 'hg008t_bicseq2',
          loc: 'chr5:6,000,000',
          fracY: 0.8,
        },
      },
      {
        type: 'text',
        text: 'gain',
        fontSize: 18,
        leader: true,
        anchor: {
          trackId: 'hg008t_bicseq2',
          loc: 'chr5:38,000,000',
          fracY: 0.3,
        },
        dx: 60,
        dy: -12,
      },
      {
        type: 'text',
        text: 'one copy lost',
        fontSize: 18,
        anchor: {
          trackId: 'hg008t_bicseq2',
          loc: 'chr5:100,000,000',
          fracY: 0.2,
        },
      },
    ],
  },

  // chr9p21.3 is where the four CNV callsets differ: the benchmark and NYGC
  // call both the CDKN2A homozygous deletion and the CN 2 segment, DRAGEN drops
  // the 20 kb deletion (its run sets --cnv-filter-length=50000), and Wakhan's
  // 50 kb segmentation holds the arm state. DRAGEN's label is split() off the
  // record ID.
  {
    mode: 'url',
    name: 'sv_cgiab/cnv_callset_comparison',
    url: sessionSpec(CGIAB_CONFIG, {
      sessionTracks: [
        HG008_DEPTH_TRACK,
        cgiabPageTrack('hg008t_nygc_cnv', 'cnv'),
        cgiabPageTrack('hg008t_dragen_cnv', 'cnv'),
        cgiabPageTrack('hg008t_wakhan_hifi_hic', 'cnv'),
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          loc: 'chr9:21,850,000-23,050,000',
          trackLabels: 'offset',
          tracks: [
            {
              trackId: 'hg38_ncbiRefSeq_ucsc',
              geneGlyphMode: 'longestCoding',
              displayMode: 'compact',
              height: 90,
            },
            {
              trackId: 'hg008_depth',
              mark: 'bar',
              color: '#0068d1',
              extent: 'none',
              scales: { y: { domainMin: 0, domainMax: 140 } },
              height: 110,
            },
            benchmarkCnvLane(),
            { trackId: 'hg008t_nygc_cnv', height: 70 },
            {
              trackId: 'hg008t_dragen_cnv',
              showLabels: 'name',
              height: 70,
            },
            {
              // Pinned so the two haplotype bands are equal; the fold report
              // cannot see this display's own height.
              trackId: 'hg008t_wakhan_hifi_hic',
              height: 120,
            },
          ],
        },
      ],
    }),
    readyText: 'chr9',
    readyTimeout: 120000,
    viewportWidth: 1500,
    viewportHeight: 990,
    annotations: [
      {
        type: 'text',
        text: 'both copies of CDKN2A gone',
        fontSize: 18,
        leader: true,
        dx: 90,
        dy: -75,
        anchor: {
          trackId: 'hg008_depth',
          loc: 'chr9:21,962,000',
          fracY: 0.9,
        },
      },
      {
        type: 'text',
        text: 'DRAGEN: no focal call',
        fontSize: 18,
        maxWidth: 480,
        leader: true,
        dx: 90,
        anchor: {
          trackId: 'hg008t_dragen_cnv',
          loc: 'chr9:21,962,000',
          fracY: 0.7,
        },
      },
      {
        type: 'text',
        text: 'Wakhan: arm-level segments only',
        fontSize: 18,
        anchor: {
          trackId: 'hg008t_wakhan_hifi_hic',
          loc: 'chr9:22,450,000',
          fracY: 0.5,
        },
      },
    ],
  },

  // chr3: the p-arm is a one-copy loss with LOH, the q-arm balanced.
  {
    mode: 'url',
    name: 'sv_cgiab/cnv_depth_baf',
    url: sessionSpec(CGIAB_CONFIG, {
      sessionTracks: [HG008_BICSEQ2_TRACK, HG008_DEPTH_TRACK, HG008_BAF_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          loc: 'chr3',
          tracks: [
            {
              trackId: 'grch38_cytobands',
              displayMode: 'collapsed',
              height: 30,
            },
            HG008_BICSEQ2_LANE,
            {
              trackId: 'hg008_depth',
              // Pinned: the outlier fence's spike room flattens the arm step.
              mark: 'point',
              color: '#0068d1',
              extent: 'none',
              size: 1,
              resolution: 10,
              height: 180,
              scales: { y: { domainMin: 0, domainMax: 150, grid: true } },
            },
            {
              trackId: 'hg008_baf',
              // Points, since a line averages the two LOH bands into 0.5.
              mark: 'point',
              size: 1,
              scales: { y: { domainMin: 0, domainMax: 1 } },
              height: 140,
            },
            benchmarkCnvLane(),
          ],
        },
      ],
    }),
    readyText: 'chr3',
    readyTimeout: 90000,
    viewportWidth: 1500,
    viewportHeight: 972,
    annotations: [
      {
        type: 'text',
        text: 'p-arm: one copy left, heterozygosity lost',
        fontSize: 18,
        anchor: { trackId: 'hg008_depth', loc: 'chr3:45,000,000', fracY: 0.12 },
      },
      {
        type: 'text',
        text: 'q-arm: two copies, both alleles',
        fontSize: 18,
        anchor: {
          trackId: 'hg008_depth',
          loc: 'chr3:145,000,000',
          fracY: 0.85,
        },
      },
    ],
  },

  // CDKN2A's homozygous deletion (SV_75, CN 0) inside a CN 1 arm. The two
  // per-base coverage rows share one fixed 0..80 axis; autoscaling each row
  // would make them incomparable.
  {
    mode: 'url',
    name: 'sv_cgiab/driver_cdkn2a_deletion',
    url: sessionSpec(CGIAB_CONFIG, {
      sessionTracks: [
        HG008_BICSEQ2_TRACK,
        {
          type: 'MultiQuantitativeTrack',
          trackId: 'hg008_tn_perbase',
          name: 'HG008 tumor vs matched normal coverage (per-base)',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'MultiWiggleAdapter',
            subadapters: [
              {
                type: 'BigWigAdapter',
                name: 'HG008-T (tumor)',
                color: '#e41a1c',
                bigWigLocation: {
                  uri: 'https://jbrowse.org/demos/cgiab/HG008-T_coverage_perbase.bw',
                  locationType: 'UriLocation',
                },
              },
              {
                type: 'BigWigAdapter',
                name: 'HG008-N (normal)',
                color: '#377eb8',
                bigWigLocation: {
                  uri: 'https://jbrowse.org/demos/cgiab/HG008-N-P_PacBio-HiFi-Revio_20240125_35x_GRCh38-GIABv3.cram.all.bw',
                  locationType: 'UriLocation',
                },
              },
            ],
          },
        },
        {
          // Re-declared to raise fetchSizeLimit past the default 5 MB.
          type: 'AlignmentsTrack',
          trackId: 'hg008_t_reads_cdkn2a',
          name: 'HG008-T PacBio HiFi reads',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BamAdapter',
            fetchSizeLimit: 30_000_000,
            bamLocation: {
              uri: HG008_T_PACBIO_BAM,
              locationType: 'UriLocation',
            },
            index: {
              indexType: 'BAI',
              location: {
                uri: `${HG008_T_PACBIO_BAM}.bai`,
                locationType: 'UriLocation',
              },
            },
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          // Narrow enough for the ~116x pileup to load.
          loc: 'chr9:21,930,000-21,990,000',
          // No highlight: a band over the p16INK4a transcript runs 3 kb past
          // the deletion's right breakpoint and tints recovered coverage.
          trackLabels: 'offset',
          tracks: [
            {
              trackId: 'hg38_ncbiRefSeq_ucsc',
              geneGlyphMode: 'longestCoding',
            },
            HG008_BICSEQ2_LANE,
            {
              trackId: 'hg008_tn_perbase',
              mark: 'bar',
              extent: 'none',
              scales: { y: { domainMin: 0, domainMax: 80, grid: false } },
              resolution: 10,
              height: 280,
            },
            {
              trackId: 'hg008_t_reads_cdkn2a',
              // 1px rows show the deletion as a coverage shape. `fixed`, since
              // fit ignores featureHeight. `unit: 'read'`: chain connectors
              // across the deletion merge into a solid grey block at 1px.
              heightMode: 'fixed',
              pileup: { readHeight: 1 },
              height: 160,
            },
            benchmarkCnvLane(),
          ],
        },
      ],
    }),
    readyText: 'chr9',
    readyTimeout: 120000,
    viewportWidth: 1500,
    viewportHeight: 1162,
  },

  // KRAS: a CN 3 (2+1) gain, where BAF splits into bands near 1/3 and 2/3.
  {
    mode: 'url',
    name: 'sv_cgiab/driver_kras_gain',
    url: sessionSpec(CGIAB_CONFIG, {
      sessionTracks: [
        KRAS_MANE.track,
        HG008_BICSEQ2_TRACK,
        HG008_DEPTH_TRACK,
        HG008_BAF_TRACK,
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          loc: 'chr12:23,000,000-27,500,000',
          tracks: [
            // Boxed: 45 kb of a 4.5 Mb frame is about 15 px.
            KRAS_MANE.lane,
            HG008_BICSEQ2_LANE,
            {
              trackId: 'hg008_depth',
              mark: 'point',
              color: '#0068d1',
              extent: 'none',
              size: 3,
              height: 140,
              resolution: 10,
            },
            {
              trackId: 'hg008_baf',
              mark: 'point',
              size: 2,
              scales: { y: { domainMin: 0, domainMax: 1 } },
              height: 140,
            },
            benchmarkCnvLane(),
          ],
        },
      ],
    }),
    readyText: 'chr12',
    readyTimeout: 90000,
    viewportWidth: 1500,
    viewportHeight: 952,
  },

  // chr17: the p-arm is a one-copy loss with LOH, the q-arm copy-neutral LOH.
  // Depth alone cannot see the q-arm event; BAF splits off 0.5 on both.
  {
    mode: 'url',
    name: 'sv_cgiab/cnv_chr17_loh',
    url: sessionSpec(CGIAB_CONFIG, {
      sessionTracks: [
        TP53_MANE.track,
        HG008_BICSEQ2_TRACK,
        HG008_DEPTH_TRACK,
        HG008_BAF_TRACK,
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          loc: 'chr17:1-83,257,441',
          // Labels on their own row: `offset` boxes cover the first 10 Mb, and
          // TP53 sits at 7.7 Mb.
          tracks: [
            TP53_MANE.lane,
            HG008_BICSEQ2_LANE,
            {
              trackId: 'hg008_depth',
              mark: 'point',
              color: '#0068d1',
              extent: 'none',
              size: 1,
              height: 140,
              resolution: 10,
              scales: { y: { domainMin: 0, domainMax: 140 } },
            },
            {
              trackId: 'hg008_baf',
              mark: 'point',
              size: 1,
              scales: { y: { domainMin: 0, domainMax: 1 } },
              height: 140,
            },
            benchmarkCnvLane(),
          ],
        },
      ],
    }),
    readyText: 'chr17',
    readyTimeout: 90000,
    viewportWidth: 1500,
    viewportHeight: 952,
    annotations: [
      {
        type: 'text',
        text: 'p-arm: one copy left, heterozygosity lost',
        fontSize: 18,
        anchor: {
          trackId: 'hg008_depth',
          loc: 'chr17:12,000,000',
          fracY: 0.15,
        },
      },
      {
        type: 'text',
        text: 'q-arm: two copies, both of one allele',
        fontSize: 18,
        anchor: {
          trackId: 'hg008_depth',
          loc: 'chr17:45,000,000',
          fracY: 0.85,
        },
      },
    ],
  },

  {
    mode: 'url',
    name: 'sv_cgiab/driver_smad4_loh',
    url: sessionSpec(CGIAB_CONFIG, {
      sessionTracks: [
        SMAD4_MANE.track,
        HG008_BICSEQ2_TRACK,
        HG008_INDEXCOV_TRACK,
        HG008_BAF_TRACK,
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          loc: 'chr18:1-80,373,285',
          // `offset` is safe here: SMAD4 sits at 51 Mb, clear of the name
          // boxes.
          trackLabels: 'offset',
          tracks: [
            SMAD4_MANE.lane,
            HG008_BICSEQ2_LANE,
            {
              trackId: 'hg008_cnv_indexcov',
              mark: 'point',
              rows: '',
              scales: { y: { domainMin: 0, domainMax: 3, grid: true } },
              resolution: 8,
              height: 200,
            },
            {
              trackId: 'hg008_baf',
              mark: 'point',
              size: 1,
              scales: { y: { domainMin: 0, domainMax: 1 } },
              height: 140,
            },
            benchmarkCnvLane(),
          ],
        },
      ],
    }),
    readyText: 'chr18',
    readyTimeout: 90000,
    viewportWidth: 1500,
    viewportHeight: 1012,
    // `textAlign: 'end'` runs the pill left from the gene's start; right of the
    // glyph is the app's own "SMAD4" label.
    annotations: [
      {
        type: 'text',
        // No copy numbers: the CNV lane draws `CN 1 (0|1)` under this
        // coordinate.
        text: 'SMAD4: heterozygous loss with LOH',
        fontSize: 16,
        textAlign: 'end',
        anchor: {
          trackId: 'mane_hg38',
          loc: 'chr18:51,030,212',
          fracY: 0.1,
          alignX: 'left',
          dx: -16,
        },
      },
    ],
  },

  {
    mode: 'url',
    name: 'sv_inspector_importform_after',
    url: sessionSpec(DEMO_CONFIG, {
      views: [{ type: 'SvInspectorView' }],
    }),
    readyText: 'Open file from URL or local computer',
    viewportWidth: 1150,
    viewportHeight: 380,
    actions: [
      { type: 'click', text: 'VCF' },
      {
        type: 'type',
        selector: '[data-testid="urlInput"]',
        value:
          'https://jbrowse.org/genomes/hg19/skbr3/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.sniffles1kb_auto_l8_s5_noalt.new.vcf',
      },
      { type: 'delay', ms: 1500 },
    ],
  },
]
