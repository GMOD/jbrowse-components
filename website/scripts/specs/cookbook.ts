import {
  DEMO_CONFIG,
  HG38_RMSK_TRACK,
  lgvSession,
  sessionSpec,
} from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// PUR (Puerto Rican, 1000 Genomes) copy-number BigWigs from the Kidd lab wired
// into a single MultiQuantitativeTrack as a session track (session tracks don't
// inherit the config's baseUri, so absolute urls are used). This mirrors the
// docs "Multiple signals on one track, each its own color" recipe exactly: named
// subadapters, one color each.
//
// Eight individuals rather than the three it started as, chosen from the data:
// scanning all 104 PUR samples over the AMY1A window gives a flat integer CN per
// sample from 1 to 4, so three samples drew three plateaus that happened to be
// adjacent. These eight cover every level and every step pattern in the
// population — 4 over the whole cluster, 4 over one block and 3 over the other,
// the reference-flat 2, and 1 (a lost copy) — which is what makes the stack read
// as individuals differing rather than as three colored bars.
const PUR_CNV = 'https://jbrowse.org/genomes/GRCh38/1000g/kidd_lab_cnv/PUR'

// Okabe-Ito, the palette the other multi-sample figures use, ordered so
// neighboring rows never share a hue.
const COOKBOOK_MULTIWIG_SAMPLES = [
  { name: 'HG01080', color: '#0072B2' },
  { name: 'HG01054', color: '#D55E00' },
  { name: 'HG00739', color: '#009E73' },
  { name: 'HG00553', color: '#CC79A7' },
  { name: 'HG01070', color: '#E69F00' },
  { name: 'HG00554', color: '#56B4E9' },
  { name: 'HG00551', color: '#8B008B' },
  { name: 'HG01083', color: '#666666' },
]

const COOKBOOK_MULTIWIG_TRACK = {
  type: 'MultiQuantitativeTrack',
  trackId: 'cookbook_multiwig',
  name: 'PUR copy number (8 samples)',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'MultiWiggleAdapter',
    subadapters: COOKBOOK_MULTIWIG_SAMPLES.map(({ name, color }) => ({
      type: 'BigWigAdapter',
      name,
      color,
      bigWigLocation: {
        uri: `${PUR_CNV}/${name}.qm2.CN.1k.bw`,
        locationType: 'UriLocation',
      },
    })),
  },
}

// The exact lookup-table recipe taught in docs/cookbook.md, kept in one place so
// the figure and the recipe text can't drift.
const RMSK_CLASS_COLOR =
  "jexl:{SINE:'#e41a1c',LINE:'#377eb8',LTR:'#4daf4a',DNA:'#984ea3',Simple_repeat:'#ff7f00',Low_complexity:'#a65628'}[get(feature,'repClass')] || 'gray'"

// Figures that back the copy-paste recipes in docs/cookbook.md. Each spec
// applies the exact recipe config to a demo track via inline per-track display
// options (the session-spec equivalent of the recipe's displayDefaults), so if a
// recipe's syntax ever goes stale the rendered figure changes and surfaces it —
// and every figure links to a live instance running that recipe.
export const cookbookSpecs: ScreenshotSpec[] = [
  // "Color by strand" recipe: NCBI RefSeq genes on hg38 (reviewer: use hg38 +
  // ncbi gff) tinted blue on the + strand and red on the - strand via the jexl
  // color slot the recipe teaches. The chr17p13 window spans several genes on
  // both strands (TP53−, WRAP53+, ATP1B2, EFNB3, …) so both colors show.
  {
    mode: 'url',
    name: 'cookbook_color_by_strand',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr17:7,400,000-7,700,000',
      tracks: [
        {
          trackId: 'ncbi_refseq_109_hg38',
          height: 260,
          color: "jexl:feature.strand==1?'#1f77b4':'#d62728'",
        },
      ],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 60000,
    settleMs: 6000,
    viewportHeight: 460,
  },

  // "Color by category (lookup table)" recipe: UCSC RepeatMasker over a
  // repeat-dense 50 kb 17q21 window, each repeat colored by its `repClass` via
  // the exact jexl lookup the recipe teaches (SINE red, LINE blue, LTR green,
  // DNA purple, Simple_repeat orange, Low_complexity brown, everything else
  // gray). A track with real categorical variety — six repeat classes visibly
  // interleaved — unlike a gene model's CDS/exon/gene handful (reviewer: "not
  // much type variety here … use a repeatmasker track").
  {
    mode: 'url',
    name: 'cookbook_color_by_type',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [
        {
          ...HG38_RMSK_TRACK,
          displays: [
            {
              type: 'LinearBasicDisplay',
              color: RMSK_CLASS_COLOR,
              // A REAL LEGEND (reviewer: "unclear what the coloring is. need
              // legend"), from the display's own `legend` slot rather than an
              // overlay this spec hand-places over a layout that moves. That
              // slot is new and exists for exactly this: a jexl color
              // expression is a lookup table whose keys live in the config, so
              // the drawn block carries the color and nothing carries what it
              // MEANS. The entries repeat the expression's own colors, which is
              // the point — the config declares the vocabulary beside the
              // expression that paints it.
              //
              // The previous answer was to relabel every feature with its
              // repClass, which said the same thing six hundred times and threw
              // away the repeat family names in the process.
              //
              // ON THE TRACK'S OWN displays, not on the view's tracks entry:
              // the spec form routes an inline key onto the display config only
              // when `isConfigurationSlot` says so, so anything else is dropped
              // in silence.
              legend: [
                { label: 'SINE', color: '#e41a1c' },
                { label: 'LINE', color: '#377eb8' },
                { label: 'LTR', color: '#4daf4a' },
                { label: 'DNA', color: '#984ea3' },
                { label: 'Simple repeat', color: '#ff7f00' },
                { label: 'Low complexity', color: '#a65628' },
                { label: 'other', color: 'gray' },
              ],
            },
          ],
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr17:45,700,000-45,750,000',
          tracks: [
            {
              trackId: 'rmsk_hg38_ucsc',
              // 260, not 380 (reviewer: "reduce width and height of this
              // figure also"). The repeats pack into about seven rows here, so
              // the extra 120px was empty track under them.
              type: 'LinearBasicDisplay',
              height: 260,
            },
          ],
        },
      ],
    }),
    readyText: 'RepeatMasker',
    readyTimeout: 60000,
    settleMs: 6000,
    // narrower too, which also brings the legend in off the right edge
    viewportWidth: 1200,
    viewportHeight: 465,
  },

  // THE SAME DATA WITH THE CATEGORY AS THE ROW rather than as the color
  // (reviewer: "consider also making a multirow canvas display of same data,
  // with different repeat types in the rows as another screenshot").
  //
  // `partitionField: 'repClass'` is the whole recipe: the display assigns each
  // feature to the row named by that attribute, so the same BED and the same
  // six classes come out as six labelled lanes. It answers a question the
  // colored figure above cannot -- how much of the window each class covers,
  // and whether a class clusters -- because in one packed lane a class's blocks
  // are interleaved with five others and the eye has to do the sorting.
  //
  // Same colors, from the same lookup, so the pair reads as one dataset seen
  // two ways rather than two datasets. `sampleColorMap` is the row-keyed form
  // of it and takes the class names as keys, so the color survives the
  // repartition without the jexl.
  //
  // No `legend` here: the rows carry their own labels, which is the point.
  {
    mode: 'url',
    name: 'cookbook_color_by_type_rows',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [HG38_RMSK_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr17:45,700,000-45,750,000',
          tracks: [
            {
              trackId: 'rmsk_hg38_ucsc',
              type: 'LinearMultiRowFeatureDisplay',
              partitionField: 'repClass',
              sampleColorMap: {
                SINE: '#e41a1c',
                LINE: '#377eb8',
                LTR: '#4daf4a',
                DNA: '#984ea3',
                Simple_repeat: '#ff7f00',
                Low_complexity: '#a65628',
              },
              // separators only: showRowLabels already defaults to true, and
              // the row names are the whole reason this form is worth showing
              showRowSeparators: true,
              height: 260,
            },
          ],
        },
      ],
    }),
    readyText: 'RepeatMasker',
    readyTimeout: 60000,
    settleMs: 6000,
    viewportWidth: 1200,
    viewportHeight: 465,
  },

  // "Multiple signals on one track, each its own color" recipe: the eight-sample
  // colored MultiQuantitativeTrack above, over the AMY1 amylase copy-number
  // locus, with the NCBI RefSeq genes for context. Rendered multirowline (one
  // stacked row per signal) so each individual's copy-number trace reads in its
  // own color. Line and not the multirowxy this used to be: the values are flat
  // integer plateaus, so a filled area paints each row as a solid bar whose only
  // readable feature is its top edge, and eight bars read as a bar chart. As
  // step traces the levels and the places they step at are the picture.
  //
  // 1.5 Mb, not the 230 kb it was (reviewer: "need to zoom out way more, hard
  // to see these thin lines without the lines varying a lot"). The old window
  // sat entirely INSIDE the amylase CNV, so every trace was two or three
  // plateaus with no baseline to read them against and no way to tell a gain
  // from a starting level. Measured over the wider window (bigWigToBedGraph on
  // the eight files, 50 kb bins): all eight are flat 2.0 across the 1.2 Mb of
  // flank, and only chr1:103.54-103.79 Mb fans out — 4.0, 4.0, 4.0, 3.0, 2.0,
  // 2.0, 1.0, 1.0. A hairline is easy to see when every other hairline is
  // level with it and one of them leaves.
  {
    mode: 'url',
    name: 'cookbook_multiwig',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [COOKBOOK_MULTIWIG_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr1:102,900,000-104,400,000',
          tracks: [
            // 70 fitted the 230 kb window's three amylase genes; over 1.5 Mb
            // the same track carries a dozen pseudogenes and their
            // descriptions, and the last row was cut off mid-label
            { trackId: 'ncbi_refseq_109_hg38', height: 130 },
            {
              trackId: 'cookbook_multiwig',
              height: 480,
              defaultRendering: 'multirowline',
              // Pinned, and identical for every row: copy number is an absolute
              // quantity, and per-row autoscale is what made the old figure
              // unreadable. Each row's own maximum became the top of its plot,
              // so a plateau at 2 and a plateau at 4 both filled their row and
              // the difference between two individuals vanished. 5 rather than 4
              // so the highest level still has headroom above it.
              minScore: 0,
              maxScore: 5,
            },
          ],
        },
      ],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 60000,
    settleMs: 8000,
    // 840 clipped 15 css px off the last trace once the gene track grew
    viewportHeight: 860,
  },
]
