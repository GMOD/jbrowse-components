import { displayPainted } from '@jbrowse/browser-test-utils'

import {
  DEMO_CONFIG,
  DERIVATIVE_ROUTE_LABEL,
  HG00151_ONT_1000G_ADAPTER,
  HG002_NANOPORE_HP_TRACK,
  PARK_CURSOR,
  VOLVOX,
  cgiabUrl,
  kgUrl,
  lgvSession,
  reconstructDerivativeAllele,
  sessionSpec,
  trackMenuIcon,
} from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// HG008-T tumor PacBio HiFi Revio reads, the same rehosted slice the hosted
// cgiab config's own reads track points at. Same reasoning as
// HG002_NANOPORE_BAM: the NCBI original is 118 GB with a ~26 MB BAI that
// downloaded on every fresh-tab capture. The slice covers the SV_20
// translocation windows (chr3 / chr13) and CDKN2A (chr9) and nothing else, each
// cut wider than the widest window that draws it so depth inside them is the
// full BAM's — build_demo_slices.sh says what a too-narrow cut looks like.
export const HG008_T_PACBIO_BAM =
  'https://jbrowse.org/demos/cgiab/HG008-T_PacBio-HiFi-Revio_116x.demo_slices.bam'

// Where C-GIAB publishes every analysis run on HG008, each in its own dated
// directory. The CNV callsets the comparison figure loads are a few KB each and
// are read from here rather than rehosted, so the figure shows the project's own
// files and a newer run is a path edit.
const CGIAB_FTP_ANALYSIS =
  'https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis'

// HG008-T (CGIAB) copy-number session tracks reused across the sv_cgiab CNV
// figures: HiFiCNV's depth track, and B-allele frequency. Both hosted BigWigs on
// jbrowse.org/demos/cgiab (see the tutorial's "Add copy-number tracks" section /
// build_sv_visualization_cgiab.sh).
//
// BAF here is deliberately NOT HiFiCNV's own maf.bw. That track is folded to
// min(AF, 1-AF), so an LOH arm collapses onto one band near 0 and the reader
// loses the mirrored 0/1 split that makes a BAF plot instantly legible to
// anyone who reads cancer genomes. Unfolded BAF over germline het sites
// (bcftools mpileup on the tumor, baf_bcftools.sh) shows both bands: an LOH arm
// splits to 0 AND 1, a balanced arm sits as one band at 0.5.
//
// resolutionMultiplier is what makes those bands survive being drawn. BAF per
// bin is a distribution, not a signal with a meaningful mean, but a bigWig zoom
// level can only carry min/avg/max: every summary bin over an LOH arm comes back
// min 0, max 1, avg noise, and the default whiskers rendering paints that as a
// full-height wash. The bigWig's finest zoom level reduces at 2560 bp and bbi
// takes a zoom level when reductionLevel <= 2*basesPerSpan, so 0.001 keeps the
// fetch on raw per-site values out to ~1.28 Mbp/px. That covers every
// single-chromosome view the figures use (whole chr1 is ~190 kbp/px) and costs
// 1.4 MB on the widest of them. Whole-genome view still summarizes, so a figure
// that needs the allelic state at that zoom wants it as SEGMENTS rather than as
// a point cloud — Wakhan's published per-haplotype copy number is the file for
// that, and the sv_visualization_cgiab tutorial carries it as a config block.
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
// The copy-number lane, and the answer to "the raw depths are hard to
// interpret" (reviewer). Depth is a per-bin read count: on a 1 Mb view it is a
// cloud a hundred points deep, and reading a copy-number step out of it means
// eyeballing where the cloud's centre moved. This is the same event already
// segmented — BIC-seq2's tumour-vs-normal log2 copy ratio, taken from the New
// York Genome Center's somatic pipeline run on this exact pair and published by
// C-GIAB, so the segmentation and the normalization are theirs and not ours
// (see [[feedback-visualizer-not-methods]]; scripts/build_sv_visualization_cgiab.sh
// carries the two-line derivation). 196 segments genome-wide, which is why it
// loads as a plain 6 KB bedGraph rather than a bigWig.
//
// The baseline is at +0.44, not 0: BIC-seq2 normalizes on total read counts and
// HG008-T is hypodiploid, so the balanced state sits above zero. Shown as
// published rather than re-centred; the STEPS are what the figures read, and
// each one lands where the benchmark says — chr3 p to q is -0.53 to +0.42
// (CN 1 to CN 2, log2(2/1) = 1.0 apart), chr18 flips the same distance over
// SMAD4, and KRAS's tandem duplication is +1.07 against the +0.45 beside it,
// which is log2(3/2).
export const HG008_BICSEQ2_TRACK = {
  type: 'QuantitativeTrack',
  trackId: 'hg008_bicseq2',
  name: 'HG008-T copy ratio, segmented (NYGC BIC-seq2, log2 T/N)',
  assemblyNames: ['GRCh38_GIABv3'],
  adapter: {
    type: 'BedGraphAdapter',
    bedGraphLocation: {
      uri: 'https://jbrowse.org/demos/cgiab/HG008-T_bicseq2_log2ratio.bedgraph',
      locationType: 'UriLocation',
    },
  },
}

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

// The matched pair, as one track: goleft indexcov coverage for the tumour and
// for its own normal. indexcov normalizes each sample to that sample's own
// median, which is the only reason two rows drawn on one axis can be read
// against each other -- the normal sits flat at 1.0 and every level the tumour
// holds is a ratio against it.
//
// Shared rather than inlined per figure, because a second copy of the two URIs
// is a second chance for one figure's normal to be a different file from
// another's. Both the chr5 CNV walkthrough and the chr18/SMAD4 driver figure
// mount it.
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

// A ONE-GENE LANE on the C-GIAB assembly, from MANE Select 1.4.
//
// Every driver figure below is named for a gene and most of them were not
// drawing it (review, on the whole set: "other tracks that enhance its
// purpose... or any other figure clarity"). The config's own UCSC RefSeq track
// cannot do this job at these windows: its chr17 slice is 40 MB of GFF, mostly
// per-transcript `description` prose, and a whole-chromosome fetch of it does
// not land inside the capture. MANE is one curated transcript per gene in a
// bigBed, so the same window is a small ranged read, and the jexl filter leaves
// a single glyph.
//
// The filter matches the MANE Select ACCESSION, not the symbol: the symbol
// lives in the bigBed's geneName2 column and filtering on it (or on the gene
// parent the adapter is meant to aggregate into) leaves the lane empty. The
// track's NAME carries the symbol instead, so the lane still labels itself.
// `forceLoad` because the density gate runs on the region's byte size, before
// any filter.
//
// The session track and the view lane come back together, because they have to
// agree on trackId and on which gene the name claims; returned as a pair rather
// than as two exports that a spec could mix up.
//
// Accessions read out of the hosted bigBed rather than recalled:
//   bigBedToBed MANE.GRCh38.v1.4.refseq.bb -chrom=chr12 -start=25200000 \
//     -end=25260000 stdout   ->   NM_004985.5  chr12:25,205,245-25,250,929
function maneGeneLane({
  symbol,
  accession,
  height = 50,
  // A gene is a few pixels wide on a whole-chromosome or multi-megabase frame,
  // so the figures at that scale box it. Given as the gene's own span, which
  // resolveFeatureHighlights matches within +/-1 bp.
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
      // LABEL THE GLYPH WITH THE SYMBOL, not with the accession. `name` in this
      // bigBed is the transcript accession, so the one glyph came out reading
      // "NM_004985.5" under a track whose name said KRAS — the reader has to
      // join those up. The symbol is the file's own `geneSymbol` column
      // (bigBedInfo -as), which is also the column the older comment here
      // guessed was `geneName2`.
      //
      // A config SLOT, so it goes in the track's `displays`, not on the view's
      // tracks entry, where it would be dropped in silence.
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
      type: 'LinearBasicDisplay',
      jexlFiltersSetting: [`jexl:get(feature,'name')=='${accession}'`],
      forceLoad: true,
      height,
      ...(featureHighlights ? { featureHighlights } : {}),
    },
  }
}

const TP53_MANE = maneGeneLane({ symbol: 'TP53', accession: 'NM_000546.6' })

// chr12:25,205,245-25,250,929 is the gene's own span in this bigBed, which is
// also what the old UCSC-RefSeq-based highlight on this figure had.
const KRAS_MANE = maneGeneLane({
  symbol: 'KRAS',
  accession: 'NM_004985.5',
  featureHighlights: [
    { refName: 'chr12', start: 25205245, end: 25250929, name: 'KRAS' },
  ],
})

// chr18:51,030,212-51,085,042, likewise read out of the bigBed. Boxed because
// this figure is the whole of chr18 and SMAD4 is 55 kb of it.
const SMAD4_MANE = maneGeneLane({
  symbol: 'SMAD4',
  accession: 'NM_005359.6',
  featureHighlights: [
    { refName: 'chr18', start: 51030212, end: 51085042, name: 'SMAD4' },
  ],
})

// SV_85's span, written the way the SV inspector's location column prints it.
// One string does both jobs the deletion_sv_inspector_search figure needs: it
// finds that cell in the spreadsheet by its text, and — since
// parseAnnotationLocus takes `..` as readily as `-` — it resolves to the
// feature's pixels in the view below through the view's own getHighlightCoords.
// The callout on the row and the callout on the glyph therefore name the same
// deletion and cannot drift apart.
const SV_85_DEL = 'chr10:122,835,344..122,837,142'

// The public catalogue that answers "is this a known bad thing" as a LANE rather
// than as prose, from `~/src/jb2hubs/ucsc2jbrowse/configs/hg38.json` and an
// hgdownload bigBed that answers ranged reads with
// `Access-Control-Allow-Origin: *`. `assemblyNames` is the C-GIAB benchmark's
// own GRCh38, not `hg38`: same coordinates, different assembly name in that
// config, and a track named for the wrong one is silently absent.
//
// COLLAPSED: the question is whether anything is catalogued here at all, which
// one row answers, and stacked rows over a 30 kb gene are most of a viewport.
const CLINVAR_CNV_TRACK = {
  type: 'FeatureTrack',
  trackId: 'hg38_clinvar_cnv_ucsc',
  name: 'ClinVar CNVs (UCSC)',
  assemblyNames: ['GRCh38_GIABv3'],
  adapter: {
    type: 'BigBedAdapter',
    bigBedLocation: {
      uri: 'https://hgdownload.soe.ucsc.edu/gbdb/hg38/bbi/clinvar/clinvarCnv.bb',
      locationType: 'UriLocation',
    },
  },
}

// The pileup band `inverted_duplication`'s callouts sit in, as an origin: the
// track's own top edge (`fracY: 0`) at the view's left edge, with each callout a
// dx/dy into it. The band is 2000px of arcs and reads in a 2010px
// capture, so a fraction of the track's height means nothing here and a viewport
// y means whatever the arc band happened to be that day.
const INVDUP_PILEUP = {
  track: 'HG02768.final',
  locus: '1:39,658,200',
  fracY: 0,
}

// hg19 main chromosomes (1..22, X, Y) in karyotype order. A plain whole-genome
// showAllRegionsInAssembly also appends the *_hap / *_random / Un contigs, whose
// far-right elided-block column reads as clutter in a genome-wide overview.
// Passed as the view's `displayedRegionNames` so the LGV init restricts to just
// these (resolved through the assembly aliases against hg19's own regions).
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

// THE SEGMENTED LOG2-RATIO LANE, ONE CONFIG FOR EVERY CGIAB FIGURE THAT CARRIES
// IT (review, on driver_smad4_loh: "please make all the cgiab use this same
// look-and-feel for the segmented track in their screenshots"). It was six
// near-identical inline copies, five of them still on the settings the smad4
// round replaced, so one track looked like two different tracks depending which
// figure you were reading.
//
// FILLED FROM ZERO, NOT A LINE (review: "the line representation of the copy
// number here is very confusing, and there is no '0' horizontal line, and the
// scale from -2 to 1.5 is very unnatural"). All three were one setting apart,
// and the line was the worst of it: a log2 ratio is a signed quantity read
// against zero, and a 1px polyline at whole-chromosome scale gives the eye
// nothing to read it against, so a whole arm at -1 looked like a flat trace
// slightly lower down. `useBicolor` (the schema default, which these used to
// switch OFF) pivots at 0, so a loss is a red block hanging below the midline
// and a gain a blue one above it: the zero line is drawn by the fill rather
// than needing to be found.
//
// The range is symmetric so zero is the middle of the lane and a step down is
// the same distance as a step up; -2..1.5 put zero at 57% of the height for no
// reason beyond where the data happened to reach. Still fixed rather than
// autoscaled, so a step means the same thing from one figure to the next: a
// homozygous deletion has no reads, BIC-seq2 writes -8.79 for it, and one such
// segment (chr17:53.93 Mb, the benchmark's CN 0) would flatten every other step
// on the chromosome into a hairline. That clips off the bottom instead, which
// is what an unbounded value should do.
//
// 130 rather than 90 because tick density follows the lane's height: at 90 the
// axis drew two labels, the two extremes, which is the other half of "there is
// no 0 horizontal line".
const HG008_BICSEQ2_LANE = {
  trackId: 'hg008_bicseq2',
  type: 'LinearWiggleDisplay',
  defaultRendering: 'xyplot',
  useBicolor: true,
  displayCrossHatches: true,
  minScore: -2,
  maxScore: 2,
  height: 130,
}

// The SKBR3 Sniffles translocation calls, which is the file
// user_guides/sv_inspector_view.md tells the reader to paste into the import
// form. Two of the figures below load it declaratively; the tour types it.
const SKBR3_SNIFFLES_VCF =
  'https://jbrowse.org/genomes/hg19/SKBR3/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.sniffles1kb_auto_l8_s5_noalt.filtered.vcf.gz'

// What videos/sv.ts films: an app with no view in it, so the tour can take the
// route the page's first sentence describes — the Add menu, the import form,
// and the file the page names.
export const svVideoFixtures = {
  emptySession: sessionSpec(DEMO_CONFIG, { views: [] }),
  callsetUrl: SKBR3_SNIFFLES_VCF,
  assembly: 'hg19',
}

// What videos/sv.ts films on HG008: the matched pair's coverage as a reader
// first gets it, which is the state neither cgiab figure holds. Both of them
// mount HG008_INDEXCOV_TRACK with the walkthrough's settings already applied
// (`multiscatter` over a fixed 0..3), so the two menu routes that page lists as
// bullets — Score → Set min/max score..., then Plot type → Overlapping →
// Scatter — happen before every picture on it.
//
// So the lane here carries NO display settings beyond its height: it arrives at
// the schema's `multirowxy` default, one filled row per sample on an autoscaled
// axis, where indexcov's centromere and repeat spikes run to 497 and press
// every plateau into the bottom of both rows.
//
// chr5 for the same reason the chr5 figure takes it: the benchmark calls three
// different allelic states on it, so the tumor row holds three levels against
// the normal's one and the payoff frame has something to be read out of.
export const cgiabVideoFixtures = {
  coverageTrackId: 'hg008_cnv_indexcov',
  coverageAsLoaded: cgiabUrl({
    sessionTracks: [HG008_INDEXCOV_TRACK],
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'GRCh38_GIABv3',
        loc: 'chr5',
        tracks: [
          {
            trackId: 'hg008_cnv_indexcov',
            type: 'MultiLinearWiggleDisplay',
            height: 200,
          },
        ],
      },
    ],
  }),
}

export const svSpecs: ScreenshotSpec[] = [
  // Gallery page + sv_visualization.md screenshots (live sessions from jbrowse.org)

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
    readyText: 'CHROM',
    readyTimeout: 60000,
    settleMs: 15000,
    // the view is its default 550px tall and the run reported 185 css px of
    // blank under it at the 800px default
    viewportHeight: 615,
  },

  // Same SKBR3 SV inspector as above, but with the spreadsheet quick-filter
  // applied. This SKBR3 sniffles set is all translocations, so the filter
  // subsets by chromosome: typing "X" narrows the table to the calls that
  // TOUCH chrX at either end, which is what the Mate column made searchable —
  // it carries the far end of each breakend, so a record leaving chr1 for chrX
  // is found by the chromosome it reaches rather than only by the one it is
  // filed under. The circular overview redraws to those chords.
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
    readyText: 'CHROM',
    readyTimeout: 60000,
    settleMs: 15000,
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

  // Before/after horizontal flip, as two independent declarative sessions
  // composed into one figure: the "after" state is just the same locus with a
  // `[rev]` locstring, so both halves are directly openable live links rather
  // than one state being reachable only by driving the view menu. Rebuilt from
  // the old server-side share link as a self-contained sessionSpec over the
  // hg19 ACTB locus (single longest-coding transcript so the strand arrow reads
  // clearly).
  {
    mode: 'url',
    name: 'horizontally_flip_before',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr7:5,562,000-5,575,000',
      tracks: [
        {
          trackId: 'ncbi_gff_hg19',
          type: 'LinearBasicDisplay',
          geneGlyphMode: 'longestCoding',
        },
      ],
    }),
    readyText: 'ACTB',
    readyTimeout: 60000,
    settleMs: 8000,
    // trim the empty viewport below the single track
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
          type: 'LinearBasicDisplay',
          geneGlyphMode: 'longestCoding',
        },
      ],
    }),
    readyText: 'ACTB',
    readyTimeout: 60000,
    settleMs: 8000,
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

  // Whole-genome CNV: COLO829 melanoma tumor vs matched normal coverage as a
  // single multi-quantitative bigWig track, shown at chromosome scale (no `loc`
  // → showAllRegionsInAssembly) with localsd ±3sd autoscale so copy-number
  // gains/losses stand out. The two sources use the default multiwiggle palette
  // (no explicit per-source colors). Rebuilt from the old server-side share link
  // as a self-contained sessionSpec/MultiWiggleAdapter over the two COLO829
  // coverage bigWigs in config_demo.json.
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
                // explicit colors: the multiwig source color is now assigned by
                // post-filter index, which flipped tumor/normal vs origin/main
                // . Pin tumor=red, normal=blue (set1 palette).
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
          // main chromosomes only (see HG19_MAIN_CHROMS): a genome-wide CNV
          // overview without the trailing unplaced-contig blocks
          displayedRegionNames: HG19_MAIN_CHROMS,
          tracks: [
            {
              trackId: 'colo829_cnv_coverage',
              type: 'MultiLinearWiggleDisplay',
              autoscale: 'localsd',
              numStdDev: 3,
              defaultRendering: 'multiscatter',
              // even finer binning (basesPerSpan = bpPerPx/resolution) so the
              // scatter resolves copy-number structure (even finer,
              // then bumped again for slightly higher resolution — the BigWig
              // zoom levels are discrete, so this has to cross a level to add
              // detail)
              resolution: 50,
              // shrink scatter points (default 2px) so the dense CNV cloud
              // reads as fine structure rather than blobs
              scatterPointSize: 1,
            },
          ],
        },
      ],
    }),
    readyText: 'COLO829',
    readyTimeout: 60000,
    settleMs: 15000,
    // the two-row track is short; crop off the empty viewport below it
    crop: { x: 0, y: 0, width: 1500, height: 390 },
    // the dense genome-wide multiscatter cloud (thousands of 1px points whose
    // exact sub-pixel positions shift with the discrete BigWig zoom-level the
    // resolution lands on) drifts a fraction of a percent between runs even
    // when nothing changed, so raise the diff gate above that noise floor to
    // stop the figure re-writing on every regen (reviewer)
    diffThreshold: 0.03,
  },

  // The 27bp heterozygous deletion in HG002 ONT reads at ~1:63,006,xxx (hg19),
  // used to drive a group-by-HP example. A single HG002 ultralong-ONT
  // track uses the display's groupBy:{type:'tag',tag:'HP'} option, which splits
  // the pileup into one subtrack per HP value at render time (the newer built-in
  // grouping — no manually-filtered duplicate session tracks). The heterozygous
  // deletion concentrates in a single haplotype, so it shows in one group and
  // not the other — a cleaner read than a colored+sorted single pileup. The HG002
  // GIAB consensus SV VCF (the DEL call) sits on top. forceLoad lifts the
  // force-load byte gate so the reads auto-load instead of sitting on "Loading";
  // readySelector waits for the pileup canvas to actually paint before capture.
  //
  // The HP colors are a code constant, not a spec field: TAG_COLOR_PALETTE in
  // plugins/alignments/src/LinearAlignmentsDisplay/colorTagUtils.ts, indexed
  // anchored at 1 so HP:1 is the pale blue and HP:2 the pink.
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
              type: 'LinearAlignmentsDisplay',
              height: 400,
              forceLoad: true,
              groupBy: { type: 'tag', tag: 'HP' },
              colorBy: { type: 'tag', tag: 'HP' },
            },
          ],
        },
      ],
    }),
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 90000,
    viewportHeight: 1000,
    settleMs: 15000,
  },

  // Alignments-track doc screenshots, autogenerated from real-human data in
  // DEMO_CONFIG (SKBR3 illumina / HG002 multi-track / 1KGP) so the colored
  // clip+insertion indicators and short-vs-long-read comparison match the doc
  // captions.

  // Colored clip indicator ticks above the coverage band. Uses the volvox
  // long-read SV BAM zoomed onto an SV breakpoint, where the reads clip hard at
  // a single column — producing a tall, unmistakable clip-indicator stack
  // (blue = left-clip, red = right-clip). The earlier SKBR3 illumina view was a
  // wide 28kb window where the ticks were tiny and scattered.
  {
    mode: 'url',
    name: 'alignment_clipping_indicators',
    // sized to the content: the rest of the viewport was page background
    viewportHeight: 497,
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:2,560-2,760',
      tracks: [
        {
          trackId: 'volvox-long-reads-sv-bam',
          type: 'LinearAlignmentsDisplay',
          // taller coverage band so the clip-indicator ticks above it are
          // large enough to read (default coverageHeight is 45)
          coverageHeight: 120,
        },
      ],
    }),
    readyText: 'ctgA',
    readyTimeout: 60000,
    settleMs: 8000,
  },

  // Inverted duplication (CPX/INVdup HGSV_2721) on real 1000-genomes data: the
  // HG02768 CRAM with linkedReads (mates drawn connected on one row) plus arc
  // read-connections and pair-orientation coloring makes the overlapping
  // inversion / tandem-dup pairing pattern visible, alongside the 1KGP ensemble
  // VCF call.
  // loc shifted ~600bp right so HGSV_2721 (near right of original range) sits
  // centered in the panel-narrowed view after the feature sidebar opens.
  // Single view at the inverted-duplication locus: orientation-colored read pairs
  // with the connecting arcs pointing upwards and a tall coverage track, with the
  // HGSV_2721 variant feature details opened.
  {
    mode: 'url',
    name: 'inverted_duplication',
    url: kgUrl({
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: '1:39,658,200-39,661,800',
          trackLabels: 'offset',
          // NO HIGHLIGHT (review: "remove highlight"). The shaded band was the
          // duplicated copy -- `DUP_chr1:39660047-39660275`, 228 bp, read off
          // the call's own INFO.CPX_INTERVALS rather than eyeballed off the
          // coverage step -- and it was carrying the word INVdup as its label,
          // which is why the callout below opens with that word instead.
          //
          // Nothing in the frame claims the dup half any more, and that is
          // honest: it is the half the read orientations say nothing about (the
          // record's other interval, `INV_chr1:39658980-39660275`, is the
          // inversion and is what they ARE about), and a 228 bp step in a
          // short-read depth profile is mostly sampling noise. The tutorial
          // names INFO.CPX_INTERVALS as where the second copy is stated.
          tracks: [
            '1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf',
            {
              trackId: 'HG02768.final',
              type: 'LinearAlignmentsDisplay',
              linkedReads: 'normal',
              readConnections: 'arc',
              // arcs drawn below the coverage band (reviewer)
              readConnectionsDown: true,
              // An arc's apex height in px is its genomic span in px (the band
              // maps availH px to availH/pxPerBp bp), clamped to the band. At
              // 3600bp over ~1030px the concordant pairs alone want ~115px, so
              // the 40px default clipped every arc to the ceiling and the band
              // was one solid mass. 200 lets the concordant domes resolve below
              // the discordant pairs spanning the 1.3kb duplication.
              readConnectionsHeight: 200,
              // COMPACT READS (reviewer: "show reads compact"), which is the
              // COMPACTNESS_PRESETS 'compact' height and the same one the
              // gallery card below already takes. It was 9 -- raised so the
              // minority LL/RR pairs read as bars rather than slivers -- and
              // 114 rows at that pitch is 1,140 px of pileup for a signal that
              // lives in the bottom fifth of it. At 3 the same rows are ~340,
              // the discordant cluster is still coloured (1px would erase it,
              // which is why this is Compact and not Super-compact), and the
              // whole figure fits a screen.
              //
              // `heightMode: 'grow'`, not a computed height, for the reason the
              // card gives: the discordant reads land at the BOTTOM of the
              // layout, so a track short by any amount scrolls away exactly the
              // thing the figure is about.
              heightMode: 'grow',
              coverageHeight: 120,
              featureHeight: 3,
              colorBy: { type: 'pairOrientation' },
              // legend is opt-in now; show the pair-orientation key so the
              // inversion color signature is readable
              showLegend: true,
            },
          ],
        },
      ],
    }),
    readyText: 'HG02768',
    readyTimeout: 60000,
    // the grown compact track, and NOT the sidebar, which is the thing that
    // stops either size report from fixing this number: the feature-details
    // drawer's INFO table runs to the bottom of any frame this VCF is opened
    // in, so "blank below the last content" is 0 at every height and the only
    // thing that gets shorter is the left half. 1075 is where the app frame
    // itself ends (measured off the capture); the table is scrollable and
    // being cut is what it does on screen too. Was 2010, when the pileup alone
    // was 1,460 of it.
    viewportHeight: 1075,
    settleMs: 30000,
    // click the HGSV_2721 variant's floating feature label (stable per-feature
    // testid) to open its feature details, then PARK THE CURSOR (review: "i
    // dont want the variant feature to have mouseover shading on it"). The wash
    // over the variant was `boxStyles.hover` in the canvas overlay, which tracks
    // the pointer and so stayed for as long as the click left it there;
    // `hideTooltip` removed the MUI tooltip above it and could never touch the
    // wash, because that box is drawn by the display rather than by a popper.
    // The selection border stays, and should: it says which feature the sidebar
    // is describing.
    actions: [
      {
        type: 'click',
        selector: '[data-testid="feature-name-HGSV_2721"]',
      },
      // wait for the feature-details widget's lazy chunk to load and populate
      // (a fixed delay races the Suspense fallback and captures an empty
      // "Loading" sidebar)
      { type: 'waitForText', text: 'CPX_TYPE' },
      PARK_CURSOR,
      { type: 'delay', ms: 1000 },
    ],
    // ONE callout, and it is a LIST (review: "please simplify the red text
    // annotation even more, like a bulleted list, so it is immensely obvious").
    // The paragraph form put the counterfactual and the colour key in the same
    // run of prose, so the reader had to parse a sentence to find each of the
    // three things the frame shows. Three bullets, one claim each, under the
    // word the call is named for -- which is where INVdup lives now that the
    // shaded band that carried it is gone.
    //
    // A newline in an annotation's `text` is a hard break and a blank line is a
    // paragraph gap, so the list is authored directly; `maxWidth` still wraps a
    // line that runs long, and a wrapped bullet does not hang-indent, which is
    // why each is short enough to fit.
    annotations: [
      // The callout anchors to the pileup track's own top edge (fracY 0 + dy),
      // so it sits a fixed distance below the arc band however tall it is,
      // instead of encoding the whole layout in a viewport y. The locus is the
      // view's left edge, which puts the pill at the track's left margin.
      {
        // inversion evidence, just below the arc band (coverage 120 + arcs 200)
        type: 'text',
        // in off the track's left edge, so the pill's border clears the app
        // frame rather than being clipped by it
        anchor: { ...INVDUP_PILEUP, dx: 50, dy: 360 },
        // NO ARC-SHAPE ARGUMENT (review: "this is a little too 'subtle' of an
        // argument for someone stumbling on this for the first time: 'where
        // ordinary pairs nest'"). Nesting is a property of the drawing, and a
        // reader meeting a pileup for the first time has never seen the
        // not-nested case to compare against. Each bullet is now a fact about
        // ONE READ PAIR, which is checkable against a single arc in the frame,
        // and the mechanism behind them is drawn in inversion_pair_orientation
        // one figure up.
        //
        // NAMED IN THE VOCABULARY THE PILEUP IS DOCUMENTED IN (review: "use more
        // technical wording for the green and navy and magenta descriptions so
        // its still understandable for a basic bioinformatician, but
        // technical"). LL/RR are the palette's own labels for these two slots
        // (`#color alignments-pair-orientation` on colorPairLL/colorPairRR,
        // rendered as a table in sv_visualization.md) and the schematic above
        // this figure carries them too, so a reader crossing from the guide to
        // the pileup meets one name for each colour. Magenta is
        // colorSplitReadInversion, whose condition is a supplementary segment
        // on the opposite strand to its primary -- SA is the tag that records
        // it, and "SA segment" is both shorter than the paraphrase and the term
        // the track menu's Group by... row uses.
        text: 'INVdup\n\n• Green = LL pair: both mates on the forward strand\n• Navy = RR pair: both mates on the reverse strand\n• Magenta = split read: SA segment on the opposite strand',
        // Wide enough that no bullet wraps: a wrapped one does not hang-indent,
        // so its second line starts under the bullet character and reads as a
        // fourth item. 920 at 24px holds the longest of the three.
        fontSize: 24,
        maxWidth: 920,
      },
    ],
  },

  // Gallery card for the same locus. The doc figure above is built to be read
  // beside prose — normal read height so the minority LL/RR pairs are legible,
  // the variant's INFO fields open, callouts naming each line of evidence. All
  // three work against a gallery card: the drawer is ~26% of the width and
  // overflows below the app frame, and the result is a 3000x4000 portrait PNG
  // where the informative discordant cluster is the bottom sixth.
  //
  // So: no drawer and no callouts. But NOT a shrunken read — the card is a
  // picture of read ORIENTATION, and orientation lives in a read's arrowhead.
  //
  // Normal reads (reviewer: "we just want to go back to normal instead of
  // compact"), which is the 7px COMPACTNESS_PRESETS entry, 1px apart. Only the
  // height is set: the gap is a pure function of it (`featureSpacingForHeight`,
  // >3 -> 1), so there is no separate spacing to ask for. This card spent a
  // long time trying to be short — Compact (3, gap 0), then 5 — on the theory
  // that a landscape card mattered more than the reads in it, and both of those
  // flatten the arrowhead that says which way a mate points. At 7 the green LL
  // and navy RR clusters are unmistakably two directions rather than two
  // colors, which is the entire subject.
  //
  // heightMode 'grow' rather than a guessed `height`: the discordant reads land
  // at the BOTTOM of the pileup layout, so a track too short by any amount
  // scrolls away exactly the thing being shown. Rows are packed by genomic
  // overlap, not by height, so the row count is fixed at ~122 and the pitch
  // sets the pileup's height outright: 8px of pitch is ~980px of pileup, well
  // past the 800px GROW_MAX_HEIGHT default, which would clamp the track and
  // scroll away the cluster grow exists to keep. Hence growMaxHeight below; it
  // is the grow ceiling only, NOT the `maxHeight` layout cap.
  {
    mode: 'url',
    name: 'gallery/inverted_duplication',
    url: kgUrl({
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
              type: 'LinearAlignmentsDisplay',
              linkedReads: 'normal',
              readConnections: 'arc',
              readConnectionsDown: true,
              // An arc's apex is its genomic span in px, clamped to the band,
              // so the band only has to clear the pairs whose apex carries
              // meaning. The card is 0.41 px/bp, where a concordant ~400bp pair
              // domes to ~165px and everything spanning the 1.3kb duplication
              // is over the ceiling either way, so most of the band was already
              // one clamped mass. 150 (reviewer: decrease it) still resolves a
              // pair up to ~370bp below the ceiling, which is where this
              // library's concordant inserts sit.
              readConnectionsHeight: 150,
              heightMode: 'grow',
              // the ceiling `grow` sizes to; see the note above. Sized to clear
              // the 8px pitch, not tuned for looks — the figure's height is
              // still set by viewportHeight against the grown track.
              growMaxHeight: 1400,
              coverageHeight: 120,
              featureHeight: 7,
              // THE SAME SCHEME THE ARCS USE (reviewer: "there are red arcs,
              // but shouldnt the read pairs that are associated with those arcs
              // also be colored red in the pileup chains"). They should, and
              // they were not: `arcColorByType` defaults to
              // insertSizeAndOrientation while the reads were on
              // pairOrientation, so a long-insert pair drew a red arc over a
              // grey read and the two halves of the same frame keyed the same
              // pair differently.
              //
              // Moving the READS to match rather than the arcs, because this
              // scheme is a superset of the one they were on: short insert wins
              // outright, then abnormal orientation, then insert size. So LL
              // green, RR navy and the magenta split reads all still paint --
              // the whole subject of the card is untouched -- and the pairs
              // spanning the duplication pick up the red their arcs already
              // had. Coloring the arcs by orientation instead would have
              // reconciled them by deleting the long-insert signal.
              colorBy: { type: 'insertSizeAndOrientation' },
              // the legend is what makes a compact card's colors readable
              showLegend: true,
            },
          ],
        },
      ],
    }),
    readyText: 'HG02768',
    readyTimeout: 60000,
    // must clear the grown track, else the capture crops exactly the discordant
    // cluster at the bottom of the layout — measured against the rendered app
    // rather than guessed, so there is no trailing whitespace. Tracks the pitch:
    // 1010 at 4px, 1390 at 6, this at 8.
    viewportHeight: 1635,
    settleMs: 30000,
  },

  // Same inversion, short reads vs long reads, in ONE sample (HG00151). The
  // companion to inverted_duplication: that figure shows how short paired-end
  // reads only *infer* an inversion (from discordant pair orientation + a few
  // split reads at the breakpoints). Here a ~1.2 kb pure inversion (HGSV_10047,
  // chr1:197,787,660-197,788,855, called by the 1KGP Illumina ensemble AND by the
  // 1000G-ONT consortium's SV callers) is shown with HG00151 Oxford Nanopore
  // (long) reads: single reads span the whole inverted segment, so each crosses
  // both breakpoints and splits into a forward + a reverse-strand supplementary
  // alignment — linked-read layout chains the segments inline so the reverse
  // core paints its flipped-strand color between the forward flanks, and the
  // split-read junctions arc in magenta between the breakpoints, directly
  // reading out the inversion that short reads can only triangulate. The ONT
  // reads are the minimap2 alignment (supplementary/split reads intact — see
  // HG00151_ONT_1000G_ADAPTER).
  {
    mode: 'url',
    name: 'inversion_long_read',
    url: kgUrl({
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
              // link supplementary alignments: chains each long read's split
              // segments, so the reverse-strand core paints its flipped-strand
              // color inline between the forward flanks.
              linkedReads: 'normal',
              readConnections: 'arc',
              // Each inversion-spanning read's two split junctions land on the
              // two breakpoints (~1.2 kb apart, on-screen) and color magenta.
              // drawInter/drawLongRange OFF drop these reads' genuine
              // cross-chromosome (chr4/chrX/...) and far-flank supplementary
              // connectors, leaving just the clean local inversion arc. The band
              // only has to hold one dome ~1.2 kb wide, so it is kept shallow —
              // at 130 the arc was the tallest thing in the figure and the reads
              // it describes were pushed down to make room for it.
              drawInter: false,
              drawLongRange: false,
              readConnectionsHeight: 60,
              // the "Not split" section runs out of rows well before the box
              // does, so the last ~180px of an 800px track was empty
              height: 620,
              coverageHeight: 70,
              colorBy: { type: 'pairOrientation' },
              // THE KEY TO THE COLOURS (reviewer: "show legend"). The figure's
              // whole claim is a strand flip -- the reverse core painting a
              // different colour between its forward flanks -- and the legend
              // is the only thing on screen that says which colour is which
              // strand. Same opt-in as inverted_duplication above, which shows
              // the short-read half of the same event.
              showLegend: true,
              // The reads that cross the breakpoints, above the reads that
              // don't: the section divider says which is which, so the figure
              // no longer needs a paragraph painted over the pileup saying it.
              // Grouping survives linked-reads mode because splitRead defines a
              // chain key (a fragment is split if any of its reads is).
              groupBy: { type: 'splitRead' },
            },
          ],
        },
      ],
    }),
    readyText: 'HG00151 Nanopore',
    readyTimeout: 90000,
    // ONE FRAME, and a wide one (reviewer: "please make this a single frame
    // picture, potentially extra-wide screenshot. it is also groupby sa in both
    // first and second screenshots, should be only in second"). It used to be
    // two stages, the Group by menu over the pileup and then the grouping — but
    // the session already carries `groupBy: splitRead`, which is what the live
    // link has to open, so the menu frame showed the radio checked over the
    // applied result and both frames were the same picture. The menu path is a
    // sentence, and the section under the figure is where it belongs.
    //
    // 1400, down from 1800 (reviewer: "decrease width of browser"). The width
    // was spent on the 5.5 kb window, so a read's forward flank / reverse core
    // / forward flank drew as three wide blocks — but the flip is a colour
    // change at a fixed pair of breakpoints, and the legend the same review
    // asked for is what names it, so the blocks do not have to be wide to be
    // read. The narrower frame also publishes at a larger scale on the page,
    // which is where 1800 was actually being lost.
    viewportWidth: 1400,
    // tall enough to clear the whole 620px track plus the second section's own
    // coverage lane and divider, which grouping adds (the pileup used to run off
    // the bottom edge — reviewer: increase browser height). 960 left 73 css px
    // of blank under the last row and 887 then cut 78 back off, which is the
    // pills: dropping them onto the coverage lanes pushed the second section
    // down. Back to a frame that holds the whole grouped track.
    viewportHeight: 966,
    settleMs: 40000,
    // the cursor would otherwise park over the pileup and raise the read tooltip
    hideTooltip: true,
    actions: [PARK_CURSOR, { type: 'delay', ms: 1500 }],
    // WHAT THE TWO SECTIONS ARE (review: "consider adding additional text
    // annotation to say that the top row of groupby is reads with SA tag
    // (split alignments) and bottom row is non-split alignments. this implies
    // basically heterozygous inversion"). The display already writes `Split
    // (SA)` and `Not split` on each divider, but those are the grouping's own
    // vocabulary and neither says what the reads under it are doing.
    //
    // Anchored to the divider labels themselves rather than to a coordinate:
    // the strip beside each is the one place on this figure that is empty at
    // any window width, and it moves with the section it names. `alignX:
    // 'right'` puts the pill's left edge past the label's right edge without a
    // dx that encodes the label's width.
    //
    // `dy` DROPS EACH PILL ONTO ITS SECTION'S COVERAGE LANE rather than leaving
    // it centred on the divider. Centred, a wrapped pill reaches as far above
    // the divider as below it, which is where the track header is — the first
    // render put the top one straight over "HG00151 Nanopore (1000G ONT,
    // minimap2)". The coverage lane under each divider is 70 px of flat grey in
    // both sections at this window, so it is the one band here that a label
    // costs nothing to cover.
    //
    // ONE LINE EACH (reviewer: "reduce wordiness. just say like 'Split reads
    // with SA tag - most showing INV' and 'Reads without SA tag'"). The two
    // pills used to spell out what the reader is looking at — three pieces, the
    // middle one reverse, the other section crossing in one piece — and that is
    // a sentence the caption can carry. On the image the pills only have to say
    // WHICH PILE each section is, because the piles look different and the
    // difference is the finding. Two lines became one, which also means each
    // pill now fits inside its own coverage lane instead of reaching into the
    // rows under it (the "Not split" one was covering four rows of reads).
    //
    // The heterozygosity the two sections add up to is in the caption instead —
    // that is a conclusion drawn from both, not a label for either.
    //
    // The SETTING is named once, on the track header (reviewer: "you can note
    // clearly that the track is 'Group by->SA tag'"). `Split read (SA tag)` is
    // the menu item's own text (`groupByLabels.ts`), so the pill is the path a
    // reader retypes rather than a paraphrase of it — and it belongs on the
    // track, not on one of the two sections, since the setting made both. The
    // label row is empty from the end of the track name to the right edge.
    //
    // ONE SIZE FOR ALL THREE (reviewer: "text annotations should all be same
    // size"). Rank is carried by where a pill sits -- the setting on the track
    // header, the findings on their own sections -- not by point size.
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

  // C-GIAB live demo screenshots (load from jbrowse.org, not local test data)

  // Single-frame SV-inspector launch: the app "Add" menu with the "SV inspector"
  // item boxed (drop the second import-form stage — the import form
  // with the pasted VCF URL is its own figure, sv_inspector_importform_after).
  {
    mode: 'url',
    name: 'sv_cgiab/translocation_sv_inspector_start',
    url: cgiabUrl({ views: [] }),
    readyText: 'Select a view to launch',
    readyTimeout: 60000,
    settleMs: 2000,
    // crop off the empty viewport below the menu
    crop: { x: 0, y: 0, width: 1500, height: 460 },
    actions: [
      { type: 'click', text: 'Add' },
      { type: 'waitForText', text: 'SV inspector' },
    ],
    // box the "Add" menu button (the path's first click) plus the "SV inspector"
    // item it opens (circle Add too)
    annotations: [
      { type: 'box', anchor: { text: 'Add' } },
      { type: 'box', anchor: { text: 'SV inspector' } },
    ],
  },

  {
    mode: 'url',
    name: 'sv_cgiab/translocation_sv_inspector_view',
    url: cgiabUrl({
      views: [
        {
          type: 'SvInspectorView',
          assembly: 'GRCh38_GIABv3',
          uri: 'https://jbrowse.org/genomes/GRCh38/cgiab/GRCh38_HG008-T-V0.5_somatic-stvar_PASS.draftbenchmark.vcf.gz',
          // SV_20 sorts to row 27 of the V0.5 benchmark's 210 PASS calls, past
          // the DataGrid's virtualization buffer at the 550px default height,
          // so the row never enters the DOM and the hover below can't find it.
          // Setting the view height (headerHeight is 52, rows are ~25px) keeps
          // the row mounted declaratively rather than driving a scroll.
          height: 1000,
        },
      ],
    }),
    readyText: 'chr1',
    readyTimeout: 60000,
    settleMs: 10000,
    // TALL ENOUGH TO HOLD THE VIEW, which is what "the figure is scrolled down
    // and looks weird" was (reviewer). The view is 1000px by the height above
    // and the default capture viewport is 800, so the view overflowed the
    // browser viewport, and the hover below is a puppeteer hover, which
    // scrollIntoViewIfNeeded's the PAGE to reach its target. The frame that
    // came out had the grid's own header row and the top of the circular plot
    // cut off above the fold and the page background showing below. Nothing
    // about the scroll was wanted; it was the side effect of the anchor.
    // 1065: 1160 held the whole view but left 95 css px of page under it,
    // which the run reports as blank below the last content.
    viewportHeight: 1065,
    // The SV_20 row (chr3:139,976,414 -> chr13:114,353,244, the same
    // translocation junction translocation_breakpoint_split drills into below)
    // is mounted in the DataGrid's virtualization buffer but scrolled below
    // the grid's own internal viewport, so its DOM rect is real but not
    // visible until scrolled into view — hover (which Puppeteer auto-scrolls
    // to) brings it on-screen before the anchor box is measured. The matching
    // chord in the circular plot is not the anchor, and the reason is better
    // than it used to be. `anchor: { chord }` now resolves a chord by its own
    // `<title>` and hit-tests along the curve (`chordAnchor.ts`), so the
    // geometry is no longer the problem — but SV_20 in particular has no pixel
    // to point at: SV_190 is the same junction written the other way round,
    // draws the same curve, and paints over it end to end
    // (`node scripts/probe-chords.ts <spec> --click=SV_20` reports exactly
    // that). So the grid row, which carries the same identity in readable text,
    // stays the anchor here.
    //
    // The id this comment used to name, `chord-vcf-19`, is SV_14 today. A
    // feature id is parse order, which is why nothing should be anchored by
    // one.
    actions: [{ type: 'hover', text: 'SV_20' }],
    annotations: [
      { type: 'box', anchor: { text: 'SV_20' } },
      // Anchored to the row it names rather than parked at (60, 90). That
      // corner is the view header and the inspector's own toolbar (search box,
      // SVTYPE dropdown), so the pill sat on the controls; and it was only
      // ever in the right place for the scroll offset it was measured against.
      // Above the row, left-aligned with it, so it reads as that row's label.
      {
        type: 'text',
        text: 'SV_20: the chr3↔chr13 translocation, drilled into below.',
        maxWidth: 420,
        anchor: { text: 'SV_20', alignX: 'left', alignY: 'top' },
        dy: -54,
      },
    ],
  },

  // The chr3<->chr13 translocation that the chord in the SV inspector
  // points at — benchmark call SV_20 joins chr3:139,976,414 to chr13:114,353,244.
  // Built declaratively as a BreakpointSplitView (init.views resolves to the two
  // child LGVs after attach), each panel showing the somatic-SV benchmark call
  // (compact VCF lane) above the 116x tumor PacBio HiFi reads in Super-compact
  // mode (featureHeight 1 / spacing 0, reviewer). showIntraviewLinks draws the
  // black splines between reads that map partially to each side of the junction.
  // The PacBio BAM is HG008_T_PACBIO_BAM, a rehosted slice carrying these two
  // windows: the NCBI original is 118 GB and its ~26 MB BAI downloaded on every
  // fresh-tab capture. forceLoad lifts the fetch-size gate so the reads
  // auto-load headless instead of sitting on a force-load prompt.
  {
    mode: 'url',
    name: 'sv_cgiab/translocation_breakpoint_split',
    url: cgiabUrl({
      views: [
        {
          type: 'BreakpointSplitView',
          // LaunchView-BreakpointSplitView takes the two child panels as a
          // top-level `views` array (loc/assembly/tracks) — it wraps them into
          // the view's transient `init` itself. Same shape as DotplotView /
          // LinearSyntenyView session specs.
          views: [
            {
              loc: 'chr3:139,971,414-139,981,414',
              assembly: 'GRCh38_GIABv3',
              tracks: [
                // the somatic-SV benchmark call, so the junction the reads
                // support is anchored to its benchmark BND on both panels
                {
                  trackId:
                    'GRCh38_HG008-T-V0.5_somatic-stvar_PASS.draftbenchmark.vcf',
                  type: 'LinearVariantDisplay',
                  height: 40,
                },
                {
                  trackId:
                    'HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3',
                  type: 'LinearAlignmentsDisplay',
                  featureHeight: 1,
                  height: 250,
                  forceLoad: true,
                },
              ],
            },
            {
              loc: 'chr13:114,348,244-114,358,244',
              assembly: 'GRCh38_GIABv3',
              tracks: [
                {
                  trackId:
                    'GRCh38_HG008-T-V0.5_somatic-stvar_PASS.draftbenchmark.vcf',
                  type: 'LinearVariantDisplay',
                  height: 40,
                },
                {
                  trackId:
                    'HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3',
                  type: 'LinearAlignmentsDisplay',
                  featureHeight: 1,
                  height: 250,
                  forceLoad: true,
                },
              ],
            },
          ],
        },
      ],
    }),
    readyText: 'HG008-T_PacBio',
    readyTimeout: 180000,
    viewportHeight: 1000,
    settleMs: 25000,
  },

  // Five somatic SV callsets over one locus, with the depth that explains them.
  // Four of the five are C-GIAB FTP URLs and nothing here was computed (see the
  // tutorial's "Structural variants from the published callsets").
  //
  // The window holds the two chr3 breakends the benchmark files under
  // EVENT=cluster_3: SV_20 at chr3:139,976,414, whose mate is on chr13, and
  // SV_21 at chr3:139,998,694, whose mate is 54 Mb down the same arm. Every
  // callset marks both, which is the concordance the figure is about, and the
  // HiFiCNV depth halves between them: ~120x left of SV_20 and ~105x right of
  // SV_21 against ~50x inside, by the bigWig's own 2 kb bins, with both steps
  // landing on a marked breakend.
  //
  // The benchmark CNV lane is the negative in the frame. Its only segment here
  // spans 101.7-182.5 Mb as CN 2 (1|1), named noCNV, so the 22 kb the SV lanes
  // bound and the depth halves over is inside a call of no change: the CNV
  // benchmark is arm-scale and clonal by construction (its README excludes
  // subclonal segments and uncertain breakpoints), and this is neither.
  //
  // The READS are not in this frame, and the reason is now editorial rather
  // than forced. A level is what this lane is for -- 2 kb bins against a fixed
  // axis, which is what makes "half" readable -- and the reads' own account of
  // the junction is two figures down the page, in the breakpoint split view and
  // the derivative reconstruction.
  //
  // It was forced once, and the record is worth keeping. The demo slice used to
  // be cut at 139,986,414, 18 kb short of this window, so a pileup drew the
  // right half of the frame tapering to ~9x where the full BAM holds ~105x --
  // reading as a coverage collapse over SV_21 while the data has a GAIN there
  // (57x -> 107x). The slice now spans chr3:139,930,000-140,010,000 and its
  // depth over this window is the full BAM's, position for position, so a
  // pileup added here would be honest. build_demo_slices.sh holds the rule.
  //
  // What differs between the callsets is how the second junction is written:
  //   - benchmark and minda: a BND, so a mark at the breakend.
  //   - Severus and DRAGEN: symbolic <INV> with SVLEN 53.9 Mb, so the lane draws
  //     a span from the breakend off the right edge of the window.
  //   - NYGC: a BEDPE record, whose near end lands at the same base.
  // Both readings are of one event, so the caption says representation rather
  // than disagreement.
  //
  // Labels stay on the benchmark lane alone. The walkthroughs name SV_20 and
  // SV_21, so that lane has to read them out; the four caller lanes carry ids
  // like DRAGEN:BND:38401:1:8:0:0:0:1 that would overlap at this width and say
  // nothing the track name does not.
  //
  // minda's is the unindexed VCF (VcfAdapter, 38 kB read whole). Its SUPP_VEC
  // names the caller runs behind each record, 9 for SV_20 and 11 for SV_21
  // across PacBio, ONT and Illumina, which is a click rather than a picture and
  // is why the tutorial carries that field in prose.
  {
    mode: 'url',
    name: 'sv_cgiab/sv_callset_comparison',
    url: cgiabUrl({
      sessionTracks: [
        HG008_DEPTH_TRACK,
        {
          type: 'VariantTrack',
          trackId: 'hg008t_severus_sv',
          name: 'Severus somatic SVs (HiFi)',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'VcfTabixAdapter',
            vcfGzLocation: {
              uri: `${CGIAB_FTP_ANALYSIS}/NIH_HiFi_Severus-SV_20240308/somatic_SVs/severus_somatic.vcf.gz`,
              locationType: 'UriLocation',
            },
            index: {
              indexType: 'TBI',
              location: {
                uri: `${CGIAB_FTP_ANALYSIS}/NIH_HiFi_Severus-SV_20240308/somatic_SVs/severus_somatic.vcf.gz.tbi`,
                locationType: 'UriLocation',
              },
            },
          },
        },
        {
          type: 'VariantTrack',
          trackId: 'hg008t_minda_sv',
          name: 'minda ensemble SVs (HiFi, ONT, Illumina)',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'VcfAdapter',
            vcfLocation: {
              uri: `${CGIAB_FTP_ANALYSIS}/NIH-NCI_minda-ensemble_20240710/HG008_minda_ensemble.vcf`,
              locationType: 'UriLocation',
            },
          },
        },
        {
          type: 'VariantTrack',
          trackId: 'hg008t_dragen_sv',
          name: 'DRAGEN somatic SVs (Illumina)',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'VcfTabixAdapter',
            vcfGzLocation: {
              uri: `${CGIAB_FTP_ANALYSIS}/DRAGEN-v4.2.4_ILMN-WGS_20240312/standard/dragen_4.2.4_HG008-mosaic_tumor.sv.vcf.gz`,
              locationType: 'UriLocation',
            },
            index: {
              indexType: 'TBI',
              location: {
                uri: `${CGIAB_FTP_ANALYSIS}/DRAGEN-v4.2.4_ILMN-WGS_20240312/standard/dragen_4.2.4_HG008-mosaic_tumor.sv.vcf.gz.tbi`,
                locationType: 'UriLocation',
              },
            },
          },
        },
        {
          type: 'VariantTrack',
          trackId: 'hg008t_nygc_sv',
          name: 'NYGC somatic SVs (Manta, GRIDSS)',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BedpeAdapter',
            bedpeLocation: {
              uri: `${CGIAB_FTP_ANALYSIS}/NYGC-somatic-pipeline_20240412/GRCh38-GIABv3/HG008-T--HG008-N.sv.annotated.v7.somatic.high_confidence.final.bedpe`,
              locationType: 'UriLocation',
            },
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          // both cluster_3 breakends on chr3, 22 kb apart, with flanking room
          loc: 'chr3:139,970,000-140,005,000',
          trackLabels: 'offset',
          tracks: [
            {
              trackId:
                'GRCh38_HG008-T-V0.5_somatic-stvar_PASS.draftbenchmark.vcf',
              type: 'LinearVariantDisplay',
              height: 55,
            },
            {
              trackId: 'hg008t_severus_sv',
              type: 'LinearVariantDisplay',
              showLabels: 'none',
              height: 45,
            },
            {
              trackId: 'hg008t_minda_sv',
              type: 'LinearVariantDisplay',
              showLabels: 'none',
              height: 45,
            },
            {
              trackId: 'hg008t_dragen_sv',
              type: 'LinearVariantDisplay',
              showLabels: 'none',
              height: 45,
            },
            {
              trackId: 'hg008t_nygc_sv',
              type: 'LinearVariantDisplay',
              showLabels: 'none',
              height: 45,
            },
            {
              // xyplot over a fixed range, not scatter: 2 kb bins put ~17 points
              // across this window, and the halving is a level to read off an
              // axis that does not move with the view
              trackId: 'hg008_depth',
              type: 'LinearWiggleDisplay',
              defaultRendering: 'xyplot',
              useBicolor: false,
              summaryScoreMode: 'avg',
              minScore: 0,
              maxScore: 140,
              displayCrossHatches: true,
              height: 180,
            },
            'hg008_cnv_calls',
          ],
        },
      ],
    }),
    readyText: 'chr3',
    readyTimeout: 180000,
    viewportWidth: 1500,
    // 760 cut the CNV lane off, 196 css px of it by the run's own report
    viewportHeight: 956,
    settleMs: 20000,
  },

  // The reconstruction picker over the same junction the split view above
  // draws, for the "three ways" walkthrough. The two other witnesses are
  // already on the page (the benchmark BND in the SV inspector figure, the
  // tumour contig in the synteny/dotplot ones), so the one picture missing is
  // what the READS say on their own.
  //
  // A single frame, and deliberately the DIALOG rather than the view it draws.
  // The view is a two-segment synteny panel that looks like every other one on
  // this page; the ranked list is the thing this section is about, because the
  // rows under the top one are terminal-repeat mismapping and the walkthrough
  // asks the reader to read them as such.
  //
  // BOTH demo slices are displayed, and that is what makes the list a list.
  // Shot on the chr3 side alone the picker offers exactly ONE route, because
  // the routes the walkthrough asks the reader to weigh against it are built
  // from chr13 reads whose other end lands in some other chromosome's terminal
  // repeat — chr13's q-terminus is inside the second slice and chr3's window is
  // nowhere near a telomere. `computeReadChains` is fed one entry per displayed
  // region, so a region that is not on screen contributes no chain, however
  // fully its reads' SA tags describe one.
  //
  // The two `loc` regions are the exact windows `realReads.cgiab.test.ts`
  // builds its fixture from — so the figure and the test read the same records,
  // and the ranked list here is the one those three `it`s assert against. They
  // sit inside the demo slice's own cut with room to spare, which is what makes
  // the read counts in the list the full BAM's; when the slice was narrower
  // than these windows the chr13 arm lost routes off its left edge and the
  // ranking was partly an artifact of the cut.
  {
    mode: 'url',
    name: 'sv_cgiab/three_ways',
    url: cgiabUrl({
      views: [
        {
          type: 'LinearGenomeView',
          loc: 'chr3:139,936,789-139,986,329 chr13:114,317,474-114,353,942',
          assembly: 'GRCh38_GIABv3',
          tracks: [
            {
              trackId:
                'GRCh38_HG008-T-V0.5_somatic-stvar_PASS.draftbenchmark.vcf',
              type: 'LinearVariantDisplay',
              height: 40,
            },
            {
              trackId: 'HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3',
              type: 'LinearAlignmentsDisplay',
              featureHeight: 1,
              height: 320,
              forceLoad: true,
            },
          ],
        },
      ],
    }),
    readyText: 'HG008-T_PacBio',
    readyTimeout: 180000,
    viewportHeight: 900,
    settleMs: 25000,
    hideTooltip: true,
    actions: [
      trackMenuIcon('HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3'),
      ...reconstructDerivativeAllele(180000),
    ],
    // How the dialog was opened. The label is the one the actions above drive
    // (DERIVATIVE_ROUTE_LABEL), so the two pages name one route identically
    // because they read one string, not because someone kept them matching.
    annotations: [
      {
        type: 'text',
        text: DERIVATIVE_ROUTE_LABEL,
        fontSize: 17,
        maxWidth: 300,
        anchor: {
          track: 'HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3',
          alignX: 'left',
          dx: 8,
          fracY: 0.8,
        },
      },
    ],
  },

  {
    // The figure depicts the LGV import/start screen showing the "Show all
    // regions in assembly" button (per its caption). An LGV with an assembly
    // but no loc relies on afterAttach's showAllRegionsInAssembly, which races
    // the (slow, remote) assembly load and silently no-ops before regions are
    // ready — so instead launch an empty view and stop on the import form,
    // mirroring the lgv_assembly spec.
    mode: 'url',
    name: 'sv_cgiab/cnv_show_all_regions',
    url: cgiabUrl({ views: [] }),
    readyText: 'Select a view to launch',
    readyTimeout: 60000,
    settleMs: 2000,
    actions: [
      { type: 'click', text: 'Launch view' },
      { type: 'waitForText', text: 'Show all regions in assembly' },
      { type: 'delay', ms: 2000 },
    ],
    // crop off the empty viewport below; tall enough for the import form (stage
    // 1) and the resulting whole-genome ruler (stage 2)
    crop: { x: 0, y: 0, width: 1500, height: 250 },
    // two-stage: stage 1 boxes the "Show all regions in assembly"
    // button on the import form; stage 2 clicks it so the result — every
    // chromosome laid out across the view — shows next
    stages: [
      {
        annotations: [
          { type: 'box', anchor: { text: 'Show all regions in assembly' } },
        ],
      },
      {
        actions: [
          { type: 'click', text: 'Show all regions in assembly' },
          { type: 'delay', ms: 8000 },
        ],
      },
    ],
  },

  // The SV inspector after searching for SV_85: the spreadsheet quick-filter is
  // typed with "SV_85" so the table narrows to that one benchmark deletion call,
  // and a linear genome view below is already navigated to the SV_85 locus
  // (chr10, in the CUZD1 gene) showing the same VCF track — the end state of
  // clicking the filtered row. Replaces a hand-curated capture.
  {
    mode: 'url',
    name: 'sv_cgiab/deletion_sv_inspector_search',
    // +140 for the one catalogue lane, off the run's own below-the-fold report
    viewportHeight: 990,
    url: cgiabUrl({
      sessionTracks: [
        CLINVAR_CNV_TRACK,
        // hg38 NCBI RefSeq genes (chr-named, CSI-indexed) so the LGV below the
        // inspector shows CUZD1's gene model over the deletion
        {
          type: 'FeatureTrack',
          trackId: 'hg38_ncbiRefSeq_ucsc',
          name: 'NCBI RefSeq genes (hg38)',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'Gff3TabixAdapter',
            gffGzLocation: {
              uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz',
              locationType: 'UriLocation',
            },
            index: {
              location: {
                uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz.csi',
                locationType: 'UriLocation',
              },
              indexType: 'CSI',
            },
          },
        },
      ],
      views: [
        {
          type: 'SvInspectorView',
          assembly: 'GRCh38_GIABv3',
          // shorter inspector so the LGV below gets more room (not so
          // tall)
          height: 420,
          uri: 'https://jbrowse.org/genomes/GRCh38/cgiab/GRCh38_HG008-T-V0.5_somatic-stvar_PASS.draftbenchmark.vcf.gz',
        },
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          loc: 'chr10:122,823,828-122,852,611',
          tracks: [
            'hg38_ncbiRefSeq_ucsc',
            // IS THIS A KNOWN BAD THING, AS TWO LANES (review: "I dont like
            // answers in prose. i want tracks that confirm. prose is tl;dr 99%
            // of the time ... we also have ~/src/jb2hubs with many tracks").
            // The previous round answered it in the tutorial's text, which is
            // where a reader is least likely to look, and it declined a lane on
            // the grounds that the somatic driver catalogues (COSMIC's Cancer
            // Gene Census among them) are licensed. That is true of the DRIVER
            // question and it is not the question the figure raises. "Is this
            // deletion a known pathogenic event" has two public answers, both
            // in jb2hubs' hg38 config and both bigBeds hgdownload serves with
            // ranged reads and `Access-Control-Allow-Origin: *`:
            //
            //   clinvarCnv.bb   ClinVar's submitted CNVs, with clinical
            //                   significance per record -- the direct answer
            //   dgvMerged.bb    the Database of Genomic Variants, i.e. the
            //                   structural variation catalogued in germline
            //                   genomes
            //
            // ONE LANE, not two. dgvMerged.bb was the second and is gone
            // (review, twice: "why do i care about common germline svs here?
            // consider remove", then "sorry i dont understand the logic here,
            // why does a somatic sv require common germline sv to 'survive'").
            // The keep argument was a false-positive prior -- that a locus which
            // is ordinary CNV territory in germline catalogues is where a
            // somatic caller most often emits something that was never somatic
            // -- and whatever its merits, it is a claim about callers that no
            // part of this frame shows. A lane a reader has to be argued into
            // is a lane that is not answering anything.
            //
            // SIZE-FILTERED, which is what makes the one that stays answer the
            // question rather than decorate it. ClinVar carries chromosome-scale
            // records -- whole-10q26 losses -- which merely CONTAIN this 1.8 kb
            // deletion, and drawn unfiltered the lane is one bar edge to edge. A
            // red bar across the window would read as "pathogenic CNV here",
            // which is exactly the wrong answer. `_varLen` is the catalogue's
            // own length field, off the bigBed autoSql. Bare expression: a
            // canvas display's jexlFilters slot adds the `jexl:` prefix
            // itself.
            {
              trackId: CLINVAR_CNV_TRACK.trackId,
              type: 'LinearBasicDisplay',
              jexlFilters: ["get(feature,'_varLen') < 50000"],
              displayMode: 'compact',
              heightMode: 'grow',
            },
            {
              trackId:
                'GRCh38_HG008-T-V0.5_somatic-stvar_PASS.draftbenchmark.vcf',
              type: 'LinearVariantDisplay',
              // The box around the deletion, drawn by the DISPLAY rather than
              // by the annotation overlay (review: "the red box isnt really
              // quite surrounding the DEL feature"). The overlay box it
              // replaces could only be positioned by hand -- a `dy` into the
              // track and a literal `height` -- because getHighlightCoords
              // answers in x only, so its vertical extent was a guess that had
              // drifted off the glyph and through the SV_85 label.
              //
              // `featureHighlights` is resolved against the fetched features
              // and boxed by whatever laid them out, so it surrounds what was
              // actually painted at whatever row and height that turned out to
              // be. This is the "utils that help find the right place for box"
              // the review asked for, and it already existed: it is the same
              // state the right-click "Highlight feature" item writes.
              //
              // By NAME, not span: the matcher takes either, but a span has to
              // agree with the record's own coordinates to within a base, and
              // the location string this figure shares with the spreadsheet
              // cell is 1-based display text rather than the interbase pair the
              // matcher compares against.
              featureHighlights: [{ refName: 'chr10', name: 'SV_85' }],
            },
          ],
        },
      ],
    }),
    // 'chr1' shows in the inspector circular/table; the LGV location is an input
    // value (not matched as text), so wait on the inspector and let settle cover
    // the remote LGV navigation/VCF load
    readyText: 'chr1',
    // 120s, not 60: the two catalogue bigBeds are hgdownload ranged reads and
    // the inspector's own VCF is remote too, and 60 started timing out on the
    // ready gate once they were added
    readyTimeout: 120000,
    settleMs: 20000,
    actions: [
      {
        type: 'type',
        selector: 'input[placeholder^="Search"]',
        value: 'SV_85',
        clear: true,
      },
      { type: 'delay', ms: 4000 },
    ],
    // Pared down to the single core narrative (too many annotations):
    // search SV_85 -> one DEL row -> clicking its location link opens the region
    // below, where SVTYPE=DEL is drawn as the <DEL> ALT allele on the variant.
    //
    // Both halves of that narrative hang off SV_85_DEL: the spreadsheet cell by
    // its text, the glyph by its coordinate. Nothing here is a viewport pixel,
    // which is what this figure specifically needed — the drift it has been
    // carrying is the whole linear view sitting lower than the day the callouts
    // were measured, and a `dy` off the VCF track's own top edge (fracY: 0)
    // moves with it.
    annotations: [
      {
        type: 'text',
        text: 'Searching "SV_85" filters to one DEL (a het CUZD1 deletion)',
        // above the one row the filter leaves, starting from that row's own
        // left edge rather than from a column of the table
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
        // tail below the location cell (clear of the box around it), head just
        // above the glyph that clicking it opens
        fromAnchor: { text: SV_85_DEL, dy: 30 },
        anchor: {
          view: 1,
          track: 'GRCh38_HG008-T-V0.5_somatic-stvar_PASS.draftbenchmark.vcf',
          locus: SV_85_DEL,
          fracY: 0,
          dy: 14,
        },
      },
      // (The box around the SV_85 <DEL> glyph is not here: it is the track's own
      // `featureHighlights`, see the view above.)
      {
        type: 'text',
        text: 'The location link opens the region below, where SVTYPE=DEL draws as the <DEL> allele',
        // beside the boxed glyph: anchoring to the deletion's right edge keeps
        // the 50px gap whatever width the deletion draws at
        anchor: {
          view: 1,
          track: 'GRCh38_HG008-T-V0.5_somatic-stvar_PASS.draftbenchmark.vcf',
          locus: SV_85_DEL,
          fracY: 0,
          alignX: 'right',
          dx: 50,
          dy: 28,
        },
        fontSize: 18,
        maxWidth: 360,
      },
      // NO CALLOUT ON THE CATALOGUE LANE (review: "the 'this lane is empty on
      // purpose' should be removed. dont make weird 'arguments' with the reader
      // or with yourself"). The lane's contribution is an ABSENCE and a callout
      // insisting on it argues with a reader who has not doubted anything yet.
      // The tutorial's paragraph states it once, plainly, which is where a fact
      // about what a catalogue does not contain belongs.
      //
      // MEASURED against the bigBed rather than read off the picture
      // (api.genome.ucsc.edu, 2026-08-13), because the size filter decides what
      // is in the lane and the answer is different above and below the cut.
      // SV_85 is chr10:122,835,344-122,837,142, and 15 clinvarCnv records span
      // this window with the SMALLEST at 2.2 Mb -- whole-arm losses, every one
      // filtered out by `_varLen < 50000`.
    ],
    // No diffThreshold: back on the default gate, deliberately.
    //
    // It carried 0.02 for "remote VCF over ftp-trace, render timing jitters the
    // circular overview", and that was never measured. `--check` with the
    // anchors in place reports **0.000%** run-to-run (0.008% on an earlier
    // measurement of the hand-placed version) — nothing about this capture is
    // nondeterministic, including the circular overview the gate was raised for.
    // Meanwhile the weekly sweep listed the figure under KEPT BEHIND A RAISED
    // diffThreshold at 0.948%: real drift, the whole linear view below the
    // inspector sitting lower than the committed bytes, held out of the picture
    // by a gate raised for something else. The one reason not to lower it was
    // that the callouts above were hand-placed, and a vertical shift is exactly
    // what moves a callout off its target. They anchor now, so the drift and the
    // callouts move together and the next sweep can commit both.
  },

  {
    mode: 'url',
    name: 'sv_cgiab/deletion_linear_view',
    url: cgiabUrl({
      sessionTracks: [
        // hg38 NCBI RefSeq genes served from the jbrowse.org/ucsc hub (chr-named,
        // CSI-indexed) — matches the GRCh38_GIABv3 chr refnames directly, so no
        // rehosting needed.
        {
          type: 'FeatureTrack',
          trackId: 'hg38_ncbiRefSeq_ucsc',
          name: 'NCBI RefSeq genes (hg38)',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'Gff3TabixAdapter',
            gffGzLocation: {
              uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz',
              locationType: 'UriLocation',
            },
            index: {
              location: {
                uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz.csi',
                locationType: 'UriLocation',
              },
              indexType: 'CSI',
            },
          },
        },
        // A small region-slice of the 116x tumor PacBio BAM (chr10:122.8-122.87Mb,
        // ~360 reads, 2.8MB) rehosted on jbrowse.org/demos/cgiab so the reads
        // auto-load fast instead of tripping the force-load guard the full 116x
        // BAM hits over this 28kb window (render the reads).
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
          // center line marks the sort column (the screen-center base the pileup
          // is sorted by — reviewer)
          showCenterLine: true,
          // The somatic SV VCF's SV_85 <DEL> call marks the deletion against the
          // NCBI RefSeq gene context (CUZD1), with the rehosted PacBio read slice
          // showing the supporting reads across the deletion.
          tracks: [
            'hg38_ncbiRefSeq_ucsc',
            'GRCh38_HG008-T-V0.5_somatic-stvar_PASS.draftbenchmark.vcf',
            {
              trackId: 'hg008t_pacbio_chr10_deletion_slice',
              // compact pileup: the "Compact" feature-height preset sets
              // featureHeight=3 (COMPACTNESS_PRESETS), a flat config-override
              // key on LinearAlignmentsDisplay. The 0 gap follows from the
              // height via featureSpacingForHeight; it is not a slot
              height: 300,
              featureHeight: 3,
              // sort reads by the base at the screen-center column
              sortedBy: {
                type: 'basePair',
                pos: 122836434,
                refName: 'chr10',
                assemblyName: 'GRCh38_GIABv3',
              },
            },
          ],
        },
      ],
    }),
    readyText: 'chr10',
    readyTimeout: 60000,
    settleMs: 20000,
  },

  {
    mode: 'url',
    name: 'sv_cgiab/cnv_with_bed_track',
    // Whole chr5 with BOTH tumor and normal coverage in a single
    // MultiQuantitativeTrack above the somatic CNV benchmark bed
    // calls, so the coverage gains/losses can be compared against the called
    // intervals. Uses the normalized indexcov bigwigs (median≈1 → reads
    // directly as copy number).
    //
    // BAF added (reviewer: "aggressively pursue ideal clean informative image.
    // we could add a baf track here"), and chr5 is the chromosome that most
    // rewards it: the benchmark calls three different allelic states on it,
    // where chr3 (sv_cgiab/cnv_depth_baf) has two. Measured off the hosted
    // bigWig, het sites per 2 Mb:
    //
    //   chr5:20-22 Mb   CN 2 (1|1)   84% of sites between 0.4 and 0.6
    //   chr5:37-39 Mb   CN 3 (2|1)   45% at 0.15-0.4 and 49% at 0.6-0.85
    //   chr5:60-62 Mb   CN 1 (0|1)   48% below 0.15, 51% above 0.85, nothing between
    //
    // so the lane draws one band, then the 1/3/2/3 pair the tutorial's table
    // predicts for a gain, then the two LOH bands -- against a coverage lane
    // where the tumor sits at 1.9 / 1.1 / 0.6 and the normal stays at 1.0.
    // The other half of the note ("plot normalized read depth also, but i want
    // a tool that does that??") is what the coverage lane already is: goleft
    // indexcov normalizes each sample to its own median, which is why the two
    // rows can be read against each other at all.
    url: cgiabUrl({
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
          // offset track labels so they overlay the tracks instead of taking a
          // dedicated row
          trackLabels: 'offset',
          tracks: [
            HG008_BICSEQ2_LANE,
            {
              trackId: 'hg008_cnv_indexcov',
              type: 'MultiLinearWiggleDisplay',
              defaultRendering: 'multiscatter',
              // Fixed 0..3, which is the manual min/max cap the walkthrough
              // tells the reader to apply, and which localsd autoscale was
              // quietly not doing: indexcov's few centromere and repeat spikes
              // run to 497, so an autoscaled axis put every plateau in the
              // bottom fifth of the lane and the three tumor levels (0.6 / 1.1
              // / 1.9 by median, against the normal's flat 1.0) were one cloud.
              minScore: 0,
              maxScore: 3,
              displayCrossHatches: true,
              // finer binning (basesPerSpan = bpPerPx/resolution) so the
              // whole-chromosome scatter resolves more CNV detail
              resolution: 8,
              height: 200,
            },
            {
              trackId: 'hg008_baf',
              type: 'LinearWiggleDisplay',
              // Same settings as the chr3 figure so the two read alike: scatter
              // over a fixed 0..1, because the value is one point per germline
              // het site and the whole signal is the spread. A line would
              // average the two LOH bands into 0.5 and erase the event. The raw
              // fetch that keeps the bands apart is HG008_BAF_TRACK's
              // resolutionMultiplier, not a display setting.
              defaultRendering: 'scatter',
              scatterPointSize: 1,
              minScore: 0,
              maxScore: 1,
              height: 140,
            },
            'GRCh38_HG008-T-V0.5_somatic-CNV_PASS.draftbenchmark.calls',
          ],
        },
      ],
    }),
    readyText: 'chr5',
    readyTimeout: 60000,
    // wider viewport so the whole-chromosome CNV + bed track aren't cut off
    viewportWidth: 1800,
    // the segmented lane(90) + the coverage rows(200) + BAF(140) + the bed
    // calls + chrome; sized rather than left to the default, which leaves blank
    // below
    // 830 left 23.6 css px under the fold, by the run's own report
    viewportHeight: 895,
    settleMs: 15000,
  },

  // Four published CNV callsets over one locus, with the signal that explains
  // them. Everything in the four call lanes is a C-GIAB FTP URL and nothing in
  // them was computed here (see the tutorial's "Copy number from the published
  // callsets"), so the figure is what a reader gets from the project's own files.
  //
  // chr9p21.3 is the window where the four can be told apart. Inside a CN 1 arm
  // the benchmark calls two events: a ~20 kb homozygous deletion over CDKN2A
  // (SV_75, CN 0) and a ~310 kb CN 2 segment 650 kb to its right (SV_76, 0+2).
  //   - benchmark (hg008_cnv_calls, from the cgiab config): both, CN-labeled.
  //   - NYGC BIC-seq2, annotated: both, on the same breakpoints, DEL then DUP.
  //   - DRAGEN: the 310 kb one as CNLOH, and nothing over the deletion. Its own
  //     command line in the VCF header sets --cnv-filter-length=50000, so a
  //     20 kb segment cannot come out of that run at all. The lane's label is
  //     split() off the record ID, which is where DRAGEN writes the class.
  //   - Wakhan per haplotype: a 50 kb segmentation, so neither event is in it and
  //     the two rows hold the arm's state across the whole window. Its scale is
  //     the arm, which is what the tutorial reaches for it at.
  // The evidence lanes are the two the page builds: HiFiCNV's binned depth, which
  // goes to the floor over the deletion and steps up over the CN 2 segment, and
  // the unfolded BAF, which has no point to draw where no copy remains.
  {
    mode: 'url',
    name: 'sv_cgiab/cnv_callset_comparison',
    url: cgiabUrl({
      sessionTracks: [
        HG008_DEPTH_TRACK,
        HG008_BAF_TRACK,
        {
          type: 'FeatureTrack',
          trackId: 'hg008t_nygc_cnv',
          name: 'NYGC CNV calls, annotated (BIC-seq2)',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BedAdapter',
            bedLocation: {
              uri: `${CGIAB_FTP_ANALYSIS}/NYGC-somatic-pipeline_20240412/GRCh38-GIABv3/HG008-T--HG008-N.cnv.annotated.v7.final.bed`,
              locationType: 'UriLocation',
            },
          },
          displays: [
            {
              type: 'LinearBasicDisplay',
              displayId: 'hg008t_nygc_cnv-LinearBasicDisplay',
              // the call is the file's own `type` column, which reaches
              // feature.type because a BED feature has no type of its own
              color: "jexl:feature.type=='DEL'?'#2166ac':'#b2182b'",
              labels: { name: "jexl:feature.type+' '+feature.cytoband" },
            },
          ],
        },
        {
          type: 'VariantTrack',
          trackId: 'hg008t_dragen_cnv',
          name: 'DRAGEN somatic CNV (Illumina)',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'VcfTabixAdapter',
            vcfGzLocation: {
              uri: `${CGIAB_FTP_ANALYSIS}/DRAGEN-v4.2.4_ILMN-WGS_20240312/standard/dragen_4.2.4_HG008-mosaic_tumor.cnv.vcf.gz`,
              locationType: 'UriLocation',
            },
            index: {
              indexType: 'TBI',
              location: {
                uri: `${CGIAB_FTP_ANALYSIS}/DRAGEN-v4.2.4_ILMN-WGS_20240312/standard/dragen_4.2.4_HG008-mosaic_tumor.cnv.vcf.gz.tbi`,
                locationType: 'UriLocation',
              },
            },
          },
          displays: [
            {
              type: 'LinearVariantDisplay',
              displayId: 'hg008t_dragen_cnv-LinearVariantDisplay',
              // DRAGEN:CNLOH:chr9:22631070-22939213 -> CNLOH, the class it
              // assigned; the whole id under a 300 kb box is unreadable
              labels: { name: "jexl:split(feature.name,':')[1]" },
              showLabels: 'name',
            },
          ],
        },
        {
          // the later of the two published Wakhan runs, phased with Hi-C. Its
          // column-name line carries no leading '#', so the names come from
          // columnNames or partitionField has nothing to partition on
          type: 'FeatureTrack',
          trackId: 'hg008t_wakhan_hifi_hic',
          name: 'Wakhan copy number per haplotype (HiFi + Hi-C)',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BedAdapter',
            columnNames: [
              'chrom',
              'start',
              'end',
              'copynumber_state',
              'coverage',
              'haplotype',
            ],
            bedLocation: {
              uri: `${CGIAB_FTP_ANALYSIS}/NIH_HiFi-HiC_Wakhan-CNA_20240424/bed_output/HG008_HiFi_HiC_copynumbers_segments.bed`,
              locationType: 'UriLocation',
            },
          },
          displays: [
            {
              type: 'LinearMultiRowFeatureDisplay',
              displayId: 'hg008t_wakhan_hifi_hic-LinearMultiRowFeatureDisplay',
              partitionField: 'haplotype',
              color:
                "jexl:get(feature,'copynumber_state')<0.5?'#2166ac':get(feature,'copynumber_state')<1.5?'#bdbdbd':'#f4a582'",
              legend: [
                { label: 'Haplotype lost (0)', color: '#2166ac' },
                { label: 'One copy', color: '#bdbdbd' },
                { label: 'Two or more copies', color: '#f4a582' },
              ],
            },
          ],
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          // CDKN2A at the left, the CN 2 segment at the right, and CN 1 arm
          // between and either side of them
          loc: 'chr9:21,850,000-23,050,000',
          trackLabels: 'offset',
          tracks: [
            {
              trackId: 'hg38_ncbiRefSeq_ucsc',
              type: 'LinearBasicDisplay',
              geneGlyphMode: 'longestCoding',
              displayMode: 'compact',
              height: 90,
            },
            {
              trackId: 'hg008_depth',
              type: 'LinearWiggleDisplay',
              defaultRendering: 'scatter',
              useBicolor: false,
              summaryScoreMode: 'avg',
              scatterPointSize: 1,
              resolution: 10,
              height: 140,
            },
            {
              trackId: 'hg008_baf',
              type: 'LinearWiggleDisplay',
              defaultRendering: 'scatter',
              scatterPointSize: 1,
              minScore: 0,
              maxScore: 1,
              height: 120,
            },
            'hg008_cnv_calls',
            'hg008t_nygc_cnv',
            'hg008t_dragen_cnv',
            {
              // Pinned, because auto-fit was dividing whatever was left over
              // and gave the two haplotypes unequal bands — the reader is being
              // asked to compare them, so they have to be the same size. It
              // also puts a margin under the lower one: the run's fold report
              // cannot see this display (its content is inside its own fixed
              // height), and at the height it settled on the lower band ran
              // into the frame's bottom border and read as cut off.
              trackId: 'hg008t_wakhan_hifi_hic',
              type: 'LinearMultiRowFeatureDisplay',
              height: 120,
            },
          ],
        },
      ],
    }),
    readyText: 'chr9',
    readyTimeout: 120000,
    viewportWidth: 1500,
    // seven lanes: 1000 left the Wakhan rows 191 css px below the fold, by the
    // run's own report; + the pinned Wakhan height and a margin under it
    viewportHeight: 1235,
    settleMs: 25000,
  },

  // The two-panel somatic-CNV view over chromosome 3: the HiFiCNV depth track
  // (copy number) above B-allele frequency (allelic state), with the benchmark
  // CNV calls below. chr3 is a clean teaching example — the p-arm is a
  // single-copy loss WITH loss-of-heterozygosity, the q-arm is balanced.
  // Verified against the V0.5 benchmark, which calls chr3p CN=1 0|1 and chr3q
  // CN=2 1|1: over chr3:30-32Mb the BAF splits to 757 points near 0 and 663
  // near 1 with nothing between, while chr3:150-152Mb sits as one band at 0.5
  // (906 + 886 points in the two central bins). Depth steps 55x -> 110x across
  // the centromere, the 2x that CN=1 vs CN=2 predicts.
  {
    mode: 'url',
    name: 'sv_cgiab/cnv_depth_baf',
    url: cgiabUrl({
      sessionTracks: [HG008_BICSEQ2_TRACK, HG008_DEPTH_TRACK, HG008_BAF_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          loc: 'chr3',
          tracks: [
            HG008_BICSEQ2_LANE,
            {
              trackId: 'hg008_depth',
              type: 'LinearWiggleDisplay',
              // scatter of the per-bin average depth; autoscale (no fixed
              // min/max) since HiFiCNV depth is raw coverage, not a ±ratio
              defaultRendering: 'scatter',
              useBicolor: false,
              summaryScoreMode: 'avg',
              scatterPointSize: 1,
              resolution: 10,
              height: 180,
              displayCrossHatches: true,
            },
            {
              trackId: 'hg008_baf',
              type: 'LinearWiggleDisplay',
              // BAF scatter over the full 0..1: the p-arm LOH splits into the
              // mirrored pair of bands at 0 and 1, the balanced q-arm stays as
              // one band at 0.5. Scatter (not line) because the value is one
              // point per germline het site, and the whole signal IS the
              // spread — a line would average the two LOH bands into a
              // meaningless 0.5 and erase the event. The raw fetch that keeps
              // those bands apart is HG008_BAF_TRACK's resolutionMultiplier, not
              // a display setting; see the note on that const.
              defaultRendering: 'scatter',
              scatterPointSize: 1,
              minScore: 0,
              maxScore: 1,
              height: 140,
            },
            'hg008_cnv_calls',
          ],
        },
      ],
    }),
    readyText: 'chr3',
    readyTimeout: 90000,
    viewportWidth: 1500,
    // taller so the benchmark CNV-calls track below the two wiggles is fully in
    // frame and each wiggle has room
    viewportHeight: 875,
    settleMs: 30000,
  },

  // sv_cgiab/cdkn2a_cn_ladder was here and is DELETED, with the two-part compose
  // it was the top half of (review: "why is this now a 2 part figure? i dont
  // want this. delete first part"). It framed 1.3 Mb of chr9 so the benchmark's
  // ABSOLUTE total_copy_number had a diploid segment on screen -- the lane read
  // 1, 0, 1, 2, 1 left to right, which is what says CN 1 is not the baseline
  // here, because the whole of 9p has lost a copy in this tumour. That is a real
  // point and it survives as the paragraph above the figure in the tutorial,
  // which is where a scale caveat belongs; it did not need half a figure.

  // CDKN2A focal homozygous deletion (chr9:21,952,497-21,972,343, benchmark
  // SV_75, total CN=0 / hap 0+0) — the canonical PDAC two-hit tumor-suppressor
  // loss. A homozygous deletion reads differently from a heterozygous (single-
  // copy) loss: depth drops to the floor (both parental copies gone), whereas
  // a het loss only halves depth. The deletion is punched into a larger
  // single-copy-loss arm (CN=1), so it shows as a deeper focal dip. Shown over
  // NCBI RefSeq genes (the config's hg38_ncbiRefSeq_ucsc, compact for CDKN2A
  // context), tumor-vs-normal per-base coverage, the raw HG008-T long-read
  // pileup with supplementary alignments linked (the deletion is a clean
  // drop-out in the reads themselves), and the CN-labeled benchmark CNV track
  // (the config's hg008_cnv_calls) whose label reads out the called copy
  // number (CN 0). The coarse log2 ratio was dropped (it duplicates the
  // per-base coverage without adding scale context at this zoom).
  //
  // The coverage lane is a MultiQuantitativeTrack over the two hosted per-base
  // bigWigs rather than HiFiCNV's binned depth, which folds in what used to be
  // a second near-identical figure (sv_cgiab/cdkn2a_tumor_normal_coverage: same
  // window, same gene lane, same CNV lane, tumor-vs-normal coverage as two
  // separate wiggle tracks). One row per sample in one track is what gives the
  // two a shared axis by construction: multirowxy with an explicit 0..80
  // minScore/maxScore, since independent autoscaling rescales each row to its
  // own data and the rows stop being comparable. Over chr9:21,953,000-21,971,000
  // the tumor mean is 0.0 (56.8x and 69.2x in the flanks) against the normal's
  // 41.9x. Per-base (mosdepth on a targeted BAM slice), not the 500bp-binned
  // log2 ratio, so the ~20kb event's boundaries resolve almost exactly: depth
  // drops from ~65x to 0 at chr9:21,952,497-21,972,343.
  {
    mode: 'url',
    name: 'sv_cgiab/driver_cdkn2a_deletion',
    url: cgiabUrl({
      sessionTracks: [
        HG008_BICSEQ2_TRACK,
        {
          // tumor over normal, one row each on a shared fixed scale
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
                // tumor red / normal blue, the same set1 pair the COLO829
                // tumor-normal figure above pins
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
          // Tumor PacBio-HiFi reads, re-declared inline so fetchSizeLimit can be
          // raised — the default 5 MB limit blocks the ~116x pileup at this scale
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
          // ~60kb around the deletion: tight enough that the ~116x read pileup
          // loads (vs the whole ±60kb overview) while still showing CDKN2A and
          // flanking single-copy-loss context
          loc: 'chr9:21,930,000-21,990,000',
          // No highlight band: the drop-out is the figure and needs no pointer,
          // and a band over the p16INK4a transcript (chr9:21,967,752-21,975,132,
          // what the gene track draws here) runs 3kb past the deletion's right
          // breakpoint at 21,972,343, tinting recovered coverage.
          // offset track labels onto their own line so the long track names
          // (fine-scale coverage / PacBio HiFi reads) don't overlap the data
          trackLabels: 'offset',
          tracks: [
            {
              // one transcript per gene rather than the full RefSeq isoform
              // stack, so CDKN2A reads as a single glyph under the highlight
              trackId: 'hg38_ncbiRefSeq_ucsc',
              type: 'LinearBasicDisplay',
              geneGlyphMode: 'longestCoding',
            },
            HG008_BICSEQ2_LANE,
            {
              // multirowxy: one filled profile per sample, stacked on the fixed
              // 0..80 range set above rather than each row's own autoscale.
              trackId: 'hg008_tn_perbase',
              type: 'MultiLinearWiggleDisplay',
              defaultRendering: 'multirowxy',
              summaryScoreMode: 'avg',
              minScore: 0,
              maxScore: 80,
              resolution: 10,
              // no cross hatches: the read is one filled profile against the
              // other, and the gridlines only add texture across both
              displayCrossHatches: false,
              height: 280,
            },
            {
              // raw long-read pileup: the homozygous deletion is a
              // clean read drop-out. linkedReads:'normal' chains each read's
              // supplementary/split alignments onto one row joined by a
              // connector ("add view as pairs / link supplementary
              // reads") so reads spanning the deletion breakpoints read as
              // coherent split alignments. (Reviewer also asked to sort the
              // split reads to the bottom of the pileup — no sort/group-by
              // option supports that while linkedReads chain mode is active,
              // since a chain's members must share one group key and
              // "is-part-of-a-chain" isn't a groupable dimension; skipped.)
              trackId: 'hg008_t_reads_cdkn2a',
              type: 'LinearAlignmentsDisplay',
              // Super-compact (featureHeight 1, the COMPACTNESS_PRESETS floor):
              // this figure is read as a coverage SHAPE — a clean drop-out
              // between two walls of reads — so 1px rows show the whole ~116x
              // pileup at once. `fixed` rather than `fit`, since fit derives its
              // own height and would ignore featureHeight. 160 is just the
              // packed stack; the old 520 was sized for fit-mode rows and left
              // two thirds of the track empty.
              //
              // linkedReads is deliberately OFF here. Chaining each read to its
              // supplementary segments draws a connector across the deletion,
              // and at 1px rows those connectors merge into a solid grey block
              // — the exact opposite of the drop-out the figure is about. The
              // reads' own deletion-spanning gaps still show as the few thin
              // lines crossing the empty stretch.
              heightMode: 'fixed',
              featureHeight: 1,
              height: 160,
            },
            'hg008_cnv_calls',
          ],
        },
      ],
    }),
    readyText: 'chr9',
    readyTimeout: 120000,
    viewportWidth: 1500,
    // 800 framed the 120px HiFiCNV depth lane this replaced; the two-row
    // coverage track is 280
    // 1075 left 17.7 css px under the fold, by the run's own report
    viewportHeight: 1135,
    settleMs: 30000,
  },

  // KRAS, the central PDAC oncogene: a low-level allelic gain (CN 3, 2+1) on
  // chr12 — positive log2 ratio with an imbalanced (but not fully split) BAF,
  // the fourth entry in the log2xBAF decision table. The raw
  // 0..1 BAF resolves the 2+1 imbalance: het SNPs split into an upper (~0.67) and
  // lower (~0.33) band rather than the single 0.5 line of a balanced region.
  // A compact NCBI RefSeq gene track (hg38_ncbiRefSeq_ucsc, from the cgiab
  // config) anchors KRAS in the gained arm, and the CN-labeled benchmark CNV
  // track (hg008_cnv_calls, also from the config) reads the opaque "SV_101" id
  // out as its copy number (the bare SV id doesn't clarify the
  // event). Zoomed out from 3.5Mb so the gain sits in flanking context.
  {
    mode: 'url',
    name: 'sv_cgiab/driver_kras_gain',
    url: cgiabUrl({
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
            // ONE GENE at 50 px, where the config's UCSC RefSeq track was 150
            // (review: "reducing the y-screen real estate can be valuable").
            // Over 4.5 Mb that lane packed five rows of about sixty gene names
            // — LOC124902897, MIR4302, BCAT1-DT — none of which this figure is
            // about, and the KRAS box had to be found among them. The box is
            // still here, on the one glyph that is left, because 45 kb of a
            // 4.5 Mb frame is about 15 px whatever else is drawn.
            KRAS_MANE.lane,
            HG008_BICSEQ2_LANE,
            {
              trackId: 'hg008_depth',
              type: 'LinearWiggleDisplay',
              defaultRendering: 'scatter',
              useBicolor: false,
              summaryScoreMode: 'avg',
              scatterPointSize: 3,
              height: 140,
              // request bigwig bins 10x finer than screen resolution so the
              // 500bp-binned log2 signal resolves at this window rather than
              // being served as a coarse bigwig zoom level
              resolution: 10,
            },
            {
              trackId: 'hg008_baf',
              type: 'LinearWiggleDisplay',
              // raw 0..1 BAF scatter. The 2+1 gain's band-split at 1/3 and 2/3
              // reads here because HG008_BAF_TRACK's resolutionMultiplier keeps
              // the fetch off the bigWig zoom levels; see the note on that const.
              defaultRendering: 'scatter',
              scatterPointSize: 2,
              minScore: 0,
              maxScore: 1,
              height: 140,
            },
            'hg008_cnv_calls',
          ],
        },
      ],
    }),
    readyText: 'chr12',
    readyTimeout: 90000,
    viewportWidth: 1500,
    // 980 held the 150 px UCSC RefSeq lane this replaced; the one-gene MANE
    // lane is 50, and the run's own reports settle the rest.
    viewportHeight: 925,
    settleMs: 20000,
    // No arrow annotation. It existed only because featureHighlights was pinned
    // to the wrong end coordinate and so drew nothing (see the highlight above),
    // and a hand-tuned pixel arrow is the thing that goes stale silently. Now
    // that the box renders, the box IS the callout — and it tracks the gene's
    // real coordinates instead of a guessed x.
  },

  // chr17: the copy-neutral-LOH teaching example — why BAF is read alongside the
  // depth ratio. The whole chromosome shows two allelic-loss states the log2 ratio
  // alone cannot tell apart:
  //   - p-arm (covering TP53): single-copy loss WITH LOH (benchmark CNA_20, CN 1,
  //     1+0) — negative log2 AND the BAF het SNPs split off the 0.5 line.
  //   - q-arm: copy-neutral LOH (benchmark CNA_21, CN 2, 2+0) — one haplotype lost
  //     and the other duplicated, so total CN stays 2 and the log2 ratio stays flat
  //     at 0, YET the BAF still splits off 0.5. Invisible to depth alone; only the
  //     BAF reveals it.
  // Same stack as the chr3/SMAD4 two-panel views: log2 over raw BAF over the
  // CN-labeled benchmark CNV calls (hg008_cnv_calls, from the cgiab config).
  {
    mode: 'url',
    name: 'sv_cgiab/cnv_chr17_loh',
    url: cgiabUrl({
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
          // labels on their own row, not overlaid: `offset` puts each track's
          // name box over the top-left of its own canvas, which on a whole
          // chromosome is the first 10 Mb — and the gene this figure was asked
          // to show sits at 7.7 Mb, under the box
          tracks: [
            // one gene, filtered to it: the caption says this arm covers TP53
            // and the figure was only asserting it (reviewer: "this isn't
            // really showing anything like a specific gene"). See maneGeneLane
            // for why it is MANE and why the filter names an accession.
            TP53_MANE.lane,
            HG008_BICSEQ2_LANE,
            {
              trackId: 'hg008_depth',
              type: 'LinearWiggleDisplay',
              defaultRendering: 'scatter',
              useBicolor: false,
              summaryScoreMode: 'avg',
              scatterPointSize: 1,
              height: 140,
              // finer bigwig bins so the 500bp-binned log2 shows across chr17
              resolution: 10,
            },
            {
              trackId: 'hg008_baf',
              type: 'LinearWiggleDisplay',
              // raw 0..1 BAF scatter: BOTH arms split off the 0.5 het line — the
              // p-arm (loss+LOH) and the q-arm (copy-neutral LOH) — which is the
              // whole point of the figure. Nothing in this chromosome is
              // balanced, so the 0.5 reference band comes from cnv_depth_baf's
              // chr3 q-arm. At this zoom the split only survives because
              // HG008_BAF_TRACK's resolutionMultiplier keeps the fetch off the
              // bigWig zoom levels, whose per-bin min/avg/max paints one wash.
              defaultRendering: 'scatter',
              scatterPointSize: 1,
              minScore: 0,
              maxScore: 1,
              height: 140,
            },
            'hg008_cnv_calls',
          ],
        },
      ],
    }),
    readyText: 'chr17',
    readyTimeout: 90000,
    viewportWidth: 1500,
    viewportHeight: 940,
    settleMs: 20000,
  },

  // SMAD4 (DPC4), the mirror image of the TP53 event: 18q loss with LOH
  // (CN 1, 0+1) — negative log2 AND the BAF het SNPs splitting off the 0.5 line.
  // The CNV calls use the config's CN-labeled hg008_cnv_calls track so the 18q
  // event reads out as its copy number + haplotype split (the bare
  // draftbenchmark SV ids don't say what the call is).
  {
    mode: 'url',
    name: 'sv_cgiab/driver_smad4_loh',
    url: cgiabUrl({
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
          // overlay the long track names on the tracks instead of a dedicated
          // label row (reviewer). Safe here in a way it was not on chr17:
          // `offset` puts each name box over the first ~10 Mb of its own
          // canvas, and the gene this figure is about is at 51 Mb.
          trackLabels: 'offset',
          tracks: [
            // SMAD4 ITSELF, which this figure is named for and did not draw
            // (review: "other tracks that enhance its purpose"). Same one-gene
            // MANE lane as the chr17 figure's TP53, boxed because 55 kb of
            // chr18 is about 1 px.
            SMAD4_MANE.lane,
            HG008_BICSEQ2_LANE,
            {
              // THE NORMAL, BESIDE THE TUMOUR (review: "use tumor vs normal to
              // contrast, show why the tumor matters here"). Every other lane
              // in this figure is the tumour on its own, so "18q is halved" was
              // a claim about a level with nothing in frame to be half OF. This
              // is the same matched-pair lane the chr5 walkthrough uses: the
              // normal runs flat at 1.0 across the whole chromosome and the
              // tumour steps to ~0.5 at 30 Mb and stays there to the telomere.
              //
              // It replaces the HiFiCNV depth lane rather than joining it. That
              // lane was the tumour's own coverage, which is the upper row of
              // this one, so keeping both would have drawn the same signal
              // twice and left the figure a lane taller.
              trackId: 'hg008_cnv_indexcov',
              type: 'MultiLinearWiggleDisplay',
              defaultRendering: 'multiscatter',
              // fixed 0..3 as on chr5: indexcov's centromere and repeat spikes
              // run into the hundreds, and an autoscaled axis puts every
              // plateau in the bottom fifth of the lane
              minScore: 0,
              maxScore: 3,
              displayCrossHatches: true,
              resolution: 8,
              height: 200,
            },
            {
              trackId: 'hg008_baf',
              type: 'LinearWiggleDisplay',
              // raw 0..1 BAF scatter: the 18q LOH splits het SNPs into upper
              // and lower bands off the 0.5 het line, against the balanced p-arm
              // beside it. At this zoom the split only survives because
              // HG008_BAF_TRACK's resolutionMultiplier keeps the fetch off the
              // bigWig zoom levels.
              defaultRendering: 'scatter',
              scatterPointSize: 1,
              minScore: 0,
              maxScore: 1,
              height: 140,
            },
            'hg008_cnv_calls',
          ],
        },
      ],
    }),
    readyText: 'chr18',
    readyTimeout: 90000,
    viewportWidth: 1500,
    // + the 50 px one-gene lane this figure gained, and the 52.7 the run then
    // reported still under the fold; then +100 for the taller copy-ratio and
    // coverage lanes, settled by the run's own report.
    viewportHeight: 985,
    settleMs: 20000,
    // WHAT STATE THE GENE IS IN, said on the image (review: "unclear why smad4
    // matters here it looks in a relatively normal area is it a heterozygous
    // deletion add red text annotation if it helps"). It is: CNA_48 is CN 1
    // with haplotype copy numbers 0 and 1, so one parental copy is gone and the
    // other is not duplicated -- a heterozygous loss that also removes an
    // allele, which is why the BAF lane splits under it and would not under a
    // copy-neutral event. The pill states that once, beside the gene it is
    // about, and the four lanes below are then evidence for it rather than an
    // exercise.
    //
    // Anchored on the gene's own lane at the gene's own start, and running LEFT
    // (`textAlign: 'end'` puts the pill's right edge on the anchor, since a
    // pill's width is only known in-page). Right of the glyph is where the app
    // draws the gene's own "SMAD4" label, and a pill there covered it; left of
    // it the lane is empty all the way back to the track name box.
    annotations: [
      {
        type: 'text',
        // No copy numbers in it: the CNV lane at the foot of the frame already
        // draws `CN 1 (0|1)` under this exact coordinate, so repeating it here
        // spends the pill on the one thing the picture does say (and see the
        // callout rule in website/CLAUDE.md). What the pill is for is the gene,
        // whose glyph is about a pixel wide at 80 Mb.
        text: 'SMAD4: heterozygous loss with LOH',
        fontSize: 16,
        textAlign: 'end',
        anchor: {
          track: 'mane_hg38',
          locus: 'chr18:51,030,212',
          fracY: 0.1,
          alignX: 'left',
          dx: -16,
        },
      },
    ],
  },

  // The subclonal-CNV section, whose config block the tutorial carries and
  // whose track the hosted demo config already loads, with no figure under it.
  // The claim the section makes is that a bulk callset averages the tumour's
  // cells together, so the three lanes are that claim's three parts: the bulk
  // depth HiFiCNV binned off the whole tumour, the benchmark's absolute CN over
  // the same window, and the per-clone rows underneath.
  //
  // The p-arm of chr3, which is where the section's own claim is visible and
  // which the depth/BAF figure above already reads as one single-copy loss with
  // LOH. The benchmark calls CN 1 across the whole arm, the bulk depth holds
  // the level that goes with it, and seven of the eight single-cell-derived
  // clones sit on CN 1 with it. 2E6 alone runs three copies from the
  // p-terminus and rejoins the others partway down the arm, so the departure
  // and its end are both inside one frame.
  //
  // Picked by scanning the published BED for a segment whose CN differs from
  // every other clone's at the same position by 2 or more. Most disagreements
  // in that file are smaller than that and are a normalization offset rather
  // than a subclone: CNVkit centres each clone on its own median and this
  // genome is hypodiploid, so a figure built on one of those would be reading
  // the centring. 2E6's is the largest of the ones that survive, and it is the
  // only one that both starts and ends inside a readable window.
  //
  // 20 Mb of a 71 Mb arm. Whole-chromosome would put the whole thing in the
  // left fifth of the frame and lose the rejoin; wider than this and the seven
  // agreeing rows stop being the point.
  {
    mode: 'url',
    name: 'sv_cgiab/subclonal_cnv',
    url: cgiabUrl({
      sessionTracks: [HG008_DEPTH_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          loc: 'chr3:1-20,000,000',
          trackLabels: 'offset',
          tracks: [
            {
              // the bulk signal the clones are the decomposition of, on the
              // same fixed axis the other cgiab depth figures use
              trackId: 'hg008_depth',
              type: 'LinearWiggleDisplay',
              defaultRendering: 'scatter',
              useBicolor: false,
              summaryScoreMode: 'avg',
              scatterPointSize: 1,
              resolution: 10,
              minScore: 0,
              maxScore: 160,
              displayCrossHatches: true,
              height: 130,
            },
            {
              // one segment covers the whole window, so the default height was
              // most of a lane of white under a single bar
              trackId: 'hg008_cnv_calls',
              type: 'LinearBasicDisplay',
              height: 45,
            },
            {
              // eight partitions share this height, and the display's own
              // auto-fit had them at ~11 px with the row labels running into
              // each other
              trackId: 'hg008_subclonal_cnv',
              type: 'LinearMultiRowFeatureDisplay',
              height: 260,
            },
          ],
        },
      ],
    }),
    readyText: 'chr3',
    readyTimeout: 120000,
    viewportWidth: 1500,
    // 700 cut the last two clone rows off, 74 css px of them by the run's own
    // report; the benchmark lane gave 55 of that back. The last 20 is a margin
    // under the bottom row that no report asks for — the multirow display's
    // content is inside its own fixed height, so the fold check cannot see the
    // band running into the frame's border, and at 720 it did.
    viewportHeight: 745,
    settleMs: 20000,
  },

  // The methylation walkthrough, which until now was the one section of the
  // tutorial with no picture in it. The claim it makes is that the SVs and the
  // 5mC come off the SAME reads with no second file, so the figure is the demo
  // slice's own BAM — the track every other read figure on the page uses —
  // recolored, and nothing else added.
  //
  // chr9:21,984,000-21,999,000, at the far end of the CDKN2A locus the deletion
  // figure above visits. Two CpG islands 3 kb apart in opposite states, which
  // is what makes this window rather than a wider one: the intronic island
  // reads methylated and the CDKN2B-AS1 promoter island reads unmethylated, so
  // a dense red block and a dense blue one sit side by side with the sparse
  // background either side of both. Measured off this slice's own MM/ML tags at
  // 500 bp: ~0.80 modified across the first, ~0.16 across the second.
  //
  // THE RIGHT EDGE IS THE DEMO SLICE'S OWN CUT (chr9:22,000,000) AND NOT A
  // CHOICE OF FRAMING. Past it only reads that reach back into the region
  // survive, so depth tapers from full to a third of it over the next 12 kb —
  // smooth, plausible, and marked by nothing in the app. A first cut of this
  // figure ran 12 kb past the edge and drew that taper as a staircase down the
  // pileup, which reads as a copy-number decline. build_demo_slices.sh is where
  // this is written down.
  //
  // `fillUnmarked` is the 2-color view — the second radio under Color by →
  // Modifications, not the first. The by-type default draws ONLY the calls at
  // or above threshold and leaves everything else blank, so an unmethylated
  // island comes out as a hole and reads as missing data. The fill paints every
  // cytosine in CpG context, so the island is blue rather than absent, and the
  // picture has both states in it.
  //
  // The deletion is deliberately out of frame. It is 12 kb to the left and it
  // is what driver_cdkn2a_deletion is about; carried in here it would be the
  // largest thing in the window and the methylation would be the small print.
  {
    mode: 'url',
    name: 'sv_cgiab/methylation_cdkn2b',
    url: cgiabUrl({
      sessionTracks: [
        {
          // same inline re-declaration as the CDKN2A figure: the config's own
          // reads track cannot raise fetchSizeLimit, and a 116x pileup over
          // 20 kb is past the 5 MB default
          type: 'AlignmentsTrack',
          trackId: 'hg008_t_reads_meth',
          name: 'HG008-T PacBio HiFi reads (5mC calls)',
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
          loc: 'chr9:21,984,000-21,999,000',
          trackLabels: 'offset',
          tracks: [
            {
              trackId: 'hg38_ncbiRefSeq_ucsc',
              type: 'LinearBasicDisplay',
              geneGlyphMode: 'longestCoding',
              displayMode: 'compact',
              height: 70,
            },
            {
              trackId: 'hg008_t_reads_meth',
              type: 'LinearAlignmentsDisplay',
              forceLoad: true,
              colorBy: {
                type: 'modifications',
                modifications: { fillUnmarked: true },
              },
              // `fit`, so the WHOLE pileup is in the frame at once. The pattern
              // this figure is about is a column, and a column only reads as one
              // if every read crossing it is drawn — at the default row height
              // the capture cut the stack off partway down and the bottom of the
              // frame looked like where the data stopped.
              heightMode: 'fit',
              height: 560,
            },
          ],
        },
      ],
    }),
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 120000,
    viewportWidth: 1500,
    // 700 cut the pileup off 175 css px short, by the run's own report
    viewportHeight: 880,
    settleMs: 25000,
  },

  // SV inspector import form with a VCF URL pasted (sv_inspector_view.md) — the
  // SKBR3 Sniffles translocation calls typed into the URL field before opening.
  {
    mode: 'url',
    name: 'sv_inspector_importform_after',
    url: sessionSpec(DEMO_CONFIG, {
      views: [{ type: 'SvInspectorView' }],
    }),
    readyText: 'Open file from URL or local computer',
    settleMs: 3000,
    // smaller capture — the import form is compact and centered
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
    // annotations removed: just the import form with the URL pasted
  },
]
