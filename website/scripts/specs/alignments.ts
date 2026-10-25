import { displayPainted } from '@jbrowse/browser-test-utils'

import {
  MODIFICATIONS_LABEL,
  UNMODIFIED_IN_BLUE_LABEL,
} from '../../../plugins/alignments/src/LinearAlignmentsDisplay/menus/baseLayerLabels.ts'
import { FIT_TO_TRACK_LABEL } from '../../../plugins/alignments/src/LinearAlignmentsDisplay/menus/compactnessPresets.ts'
import {
  DEMO_CONFIG,
  HG002_NANOPORE_HP_TRACK,
  PARK_CURSOR,
  VOLVOX,
  cascadeBoxes,
  lgvSession,
  menuCascade,
  openTrackSelector,
  sessionSpec,
  trackMenuIcon,
} from '../screenshot-spec-helpers.ts'

import type { Annotation, ScreenshotSpec } from '../screenshot-spec-types.ts'

// Sized for the sweep: the Hi-C specs run contiguously, so the pool renders four
// SwiftShader contact matrices at once. `hic/whole_genome` answers 300 region
// pairs where the others answer one.
const HIC_READY_TIMEOUT = 180000
const HIC_WHOLE_GENOME_READY_TIMEOUT = 240000

// Session tracks don't inherit the config's baseUri, so the read_cloud track
// needs an absolute url.
export const VOLVOX_SV_CRAM =
  'https://jbrowse.org/code/jb2/latest/test_data/volvox'
export const VOLVOX_SV_CRAM_ADAPTER = {
  type: 'CramAdapter',
  cramLocation: {
    uri: `${VOLVOX_SV_CRAM}/volvox-sv.cram`,
    locationType: 'UriLocation',
  },
  craiLocation: {
    uri: `${VOLVOX_SV_CRAM}/volvox-sv.cram.crai`,
    locationType: 'UriLocation',
  },
}

// Built by scripts/build_hsv1_demo.sh.
const HSV1_CONFIG = 'https://jbrowse.org/demos/hsv1/config.json'

// One anchor for the sort, the right-click and both callouts of
// `alignments_sort_by_base`.
const SORT_COLUMN = {
  trackId: 'volvox_bam',
  loc: 'ctgA:14,481',
  // Only a read carrying the mismatch offers "SNP/Mismatch", so this fraction
  // must land in the run of A rows at the top of the unsorted pileup.
  fracY: 0.22,
}

// A default box (5 px stroke, 6 px pad) draws a solid bar around one base at
// ~6 css px a base. The two boxes in `alignments/strand_split_coverage` are
// ~30 css px apart, so a pad past 8 closes the gap between them.
const COLUMN_BOX = {
  type: 'box',
  strokeWidth: 2,
  pad: 8,
} satisfies Partial<Annotation>

// One anchor for the right-click and its arrow in `linear_align_ctx_menu`. The
// pileup packs under a fixed 45 px coverage band, so a px depth of 57 stays on
// the second read row at any display height, where a `fracY` would not.
const CTX_MENU_READ = {
  trackId: 'volvox_sv_cram',
  loc: 'ctgA:1633',
  fracY: 0,
  dy: 57,
}

// The surfeit locus: abutting genes on alternating strands (RPL7A +, SURF1 -,
// SURF2 +).
function strandSpecificSpec(): ScreenshotSpec {
  const spec = (
    name: string,
    color: { field: string },
    label: string,
  ): ScreenshotSpec => ({
    mode: 'url',
    name,
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr9:136,214,000-136,229,000',
      trackLabels: 'offset',
      tracks: [
        // Reserves the strip the strand arrows sit in. Without `heightMode:
        // 'fixed'` the display grows to its content and packs snoRNA rows under
        // the arrows; `showLabels: 'name'` drops their description lines.
        {
          trackId: 'ncbi_gff_hg19',
          showLabels: 'name',
          heightMode: 'fixed',
          height: 150,
        },
        {
          trackId: 'Pairend_StrandSpecific_51mer_Human_hg19',
          encoding: { color },
          coverage: {
            // a log axis prints a tick per power of two; below 120 they overlap
            height: 120,
            // RPL7A runs ~100x the surfeit genes, which flatten on a linear axis
            encoding: { y: { scale: { type: 'log' } } },
          },
          pileup: { maxLayoutHeight: 2000 },
          filter: [{ field: 'junction.reads', gte: 3 }],
          height: 330,
        },
      ],
    }),
    readyText: 'RPL7A',
    readyTimeout: 60000,
    viewportHeight: 718,
    tooltip: 'hide',
    annotations: [
      {
        type: 'text' as const,
        fontSize: 22,
        maxWidth: 700,
        text: label,
        anchor: {
          trackId: 'ncbi_gff_hg19',
          loc: 'chr9:136,216,000',
          fracY: 0.6,
        },
      },
      // Interior coordinates, so an annotation release that moves a gene
      // boundary leaves each arrow inside its gene.
      ...(
        [
          ['RPL7A', 136_215_300, 136_218_000],
          // tail right, head left: SURF1 is the minus-strand gene
          ['SURF1', 136_222_900, 136_219_000],
          ['SURF2', 136_223_800, 136_227_500],
        ] as const
      ).map(([, from, to]) => ({
        type: 'arrow' as const,
        strokeWidth: 9,
        fromAnchor: {
          trackId: 'ncbi_gff_hg19',
          loc: `chr9:${from}`,
          fracY: 0.86,
        },
        anchor: {
          trackId: 'ncbi_gff_hg19',
          loc: `chr9:${to}`,
          fracY: 0.86,
        },
      })),
    ],
  })
  return spec(
    'rnaseq/strand_specific',
    { field: 'firstOfPairStrand' },
    'Color by first of pair strand',
  )
}

export const alignmentsSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'volvox_alignments',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_cram_alignments'],
    }),
    viewportWidth: 1000,
    viewportHeight: 550,
    readyText: 'ctgA',
  },

  {
    mode: 'url',
    name: 'sequence_track',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:20000-20050',
      tracks: ['volvox_refseq'],
    }),
    viewportWidth: 1100,
    viewportHeight: 400,
    readyText: 'ctgA',
    tooltip: 'hide',
    actions: openTrackSelector(),
  },

  {
    mode: 'url',
    name: 'alignments_soft_clipped',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:2615-2725',
      tracks: [
        {
          trackId: 'volvox-long-reads-sv-bam',
          pileup: { softClips: { show: true } },
        },
      ],
    }),
    readyText: 'ctgA',
    viewportWidth: 900,
    viewportHeight: 450,
    // the soft-clip overhang's dense base letters jitter ~1.5% between runs
    diffThreshold: 0.02,
  },

  // ctgB's pairs are all RL at a narrow insert, so its cloud is one flat band
  // with nothing at the y=0 baseline: the data, not a layout gap.
  {
    mode: 'url',
    name: 'alignments/read_cloud',
    url: sessionSpec(VOLVOX, {
      sessionTracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'volvox_sv_cram_linked',
          name: 'volvox-sv read cloud',
          assemblyNames: ['volvox'],
          adapter: VOLVOX_SV_CRAM_ADAPTER,
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          // no `loc`, so the view shows both contigs
          tracks: [
            {
              trackId: 'volvox_sv_cram_linked',
              readConnections: {
                show: true,
                mark: 'rule',
                placement: 'down',
                height: 100,
              },
              coverage: { height: 100 },
              encoding: { color: 'insertSizeAndOrientation' },
              legend: { show: true },
              height: 600,
              forceLoad: true,
            },
          ],
        },
      ],
    }),
    readyText: 'ctgA',
    viewportHeight: 805,
  },

  // The first stage must show soft clipping still off.
  {
    mode: 'url',
    name: 'alignments_soft_clipped_menu',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:2670-2730',
      tracks: ['volvox-long-reads-sv-bam'],
    }),
    readyText: 'ctgA',
    // Don't trim on the run's "blank below the last content" report: the menus
    // are portals it cannot see, and 550 cuts off the bottom of the track menu.
    viewportWidth: 1100,
    viewportHeight: 620,
    diffThreshold: 0.02,
    stages: [
      {
        actions: [
          { type: 'click', selector: '[data-testid="track_menu_icon"]' },
          ...menuCascade(['Show...', 'Soft clipping']),
        ],
        annotations: [
          { type: 'box', anchor: { text: 'Show...' } },
          { type: 'box', anchor: { text: 'Soft clipping' } },
        ],
      },
      {
        // A checkbox row keeps the menu open, so two Escapes close the submenu
        // and the track menu.
        actions: [
          { type: 'click', text: 'Soft clipping' },
          { type: 'press', key: 'Escape' },
          { type: 'press', key: 'Escape' },
          { type: 'waitForText', text: 'Soft clipping', hidden: true },
          { type: 'waitForText', text: 'Show...', hidden: true },
          // the focused track menu icon keeps its tooltip up until a click
          // elsewhere blurs it
          { type: 'click', selector: 'body' },
          PARK_CURSOR,
          // the waits above see only the menu closing, not the pileup refetch
          { type: 'waitForAppSettled' },
        ],
      },
    ],
  },

  // The depth half of strand-split coverage; HG002 ONT below is strand-balanced
  // and shows the mismatch half. Read strand is transcript strand only in this
  // library (ERR2379735): the study's randomly primed run comes back 50/50.
  // US9/US10 flips harder, but at ~2,500 reads its pileup cannot be drawn.
  {
    mode: 'url',
    name: 'alignments/strand_split_depth',
    url: lgvSession(HSV1_CONFIG, {
      assembly: 'hsv1',
      loc: 'NC_001806.2:41,900-45,300',
      tracks: [
        {
          trackId: 'hsv1_genes',
          // the GFF3's first record is the 108 kb long-unique region, which
          // packs above the genes and takes their label lane
          filter: ["jexl:feature.type=='gene'"],
          height: 70,
        },
        {
          trackId: 'hsv1_mrna',
          // the whole BAM sits in one index bin, so the byte gate overestimates
          // this window
          forceLoad: true,
          facet: 'strand',
          encoding: { color: 'strand' },
          pileup: {
            // nearly every read takes its own row; at 2 px the pileups push the
            // bands out of frame
            mark: { height: 1 },
          },
          coverage: { height: 150 },
          height: 700,
        },
      ],
    }),
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 120000,
    viewportHeight: 1015,
    tooltip: 'hide',
  },

  // Each strand's band carries its own mismatch coloring. ONT mismatches make
  // every window look busy, so pick a window with
  // `scripts/rank_strand_asymmetry.py`, not by eye.
  {
    mode: 'url',
    name: 'alignments/strand_split_coverage',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [HG002_NANOPORE_HP_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          // At 55 bp no ordinary positions give a baseline; at 600 bp ONT
          // speckle grows taller than the two marked columns.
          loc: '1:55,705,588-55,705,838',
          tracks: [
            {
              trackId: 'hg002_nanopore_hp',
              forceLoad: true,
              facet: 'strand',
              encoding: { color: 'strand' },
              pileup: {
                // ~12 reads a strand: at 3 px each pileup draws as a solid stripe
                mark: { height: 9 },
              },
              coverage: { height: 110 },
              height: 480,
            },
          ],
        },
      ],
    }),
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 90000,
    viewportHeight: 690,
    tooltip: 'hide',
    // The boxes take no `fracY`, so each wraps both bands and both pileups.
    // The pills sit in the track's label row, the only empty strip in frame;
    // above fontSize 15 they spill over the Forward strand divider.
    annotations: [
      {
        ...COLUMN_BOX,
        anchor: { trackId: 'hg002_nanopore_hp', loc: '1:55,705,711' },
      },
      {
        type: 'text',
        text: 'reverse reads only: a basecalling artifact',
        fontSize: 15,
        textAlign: 'end',
        anchor: {
          trackId: 'hg002_nanopore_hp',
          loc: '1:55,705,711',
          fracY: 0,
          // -30 lands on the ruler's tick labels
          dy: -14,
          alignX: 'left',
          dx: -14,
        },
      },
      {
        ...COLUMN_BOX,
        anchor: { trackId: 'hg002_nanopore_hp', loc: '1:55,705,716' },
      },
      {
        // the two pills extend away from each other, so 5 bp holds both
        type: 'text',
        text: 'both strands: a real variant',
        fontSize: 15,
        anchor: {
          trackId: 'hg002_nanopore_hp',
          loc: '1:55,705,716',
          fracY: 0,
          dy: -14,
          alignX: 'right',
          dx: 14,
        },
      },
    ],
  },

  {
    mode: 'url',
    name: 'linear_align_ctx_menu',
    viewportHeight: 499,
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1500-2000',
      tracks: ['volvox_sv_cram'],
    }),
    readyText: 'ctgA',
    tooltip: 'hide',
    actions: [
      { type: 'rightclick', anchor: CTX_MENU_READ },
      { type: 'waitForText', text: 'Open feature details' },
      { type: 'delay', ms: 800 },
    ],
    // The context menu clears the hover shading, so the arrow marks the read.
    annotations: [
      {
        type: 'text',
        anchor: { ...CTX_MENU_READ, dx: -231, dy: 35 },
        maxWidth: 180,
        text: 'Right-click any read to open this menu',
      },
      // the tail starts right of the pill's end so the line misses the pill
      {
        type: 'arrow',
        fromAnchor: { ...CTX_MENU_READ, dx: -32, dy: 50 },
        anchor: CTX_MENU_READ,
      },
    ],
  },

  {
    mode: 'url',
    name: 'alignments/filter_dialog',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-50000',
      tracks: ['volvox_sv_cram'],
    }),
    readyText: 'ctgA',
    // The dialog is centred, so trimming the reported blank below it crops the
    // pileup it floats over.
    viewportHeight: 580,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      { type: 'delay', ms: 500 },
      ...menuCascade(['Filter by...', 'Edit filters...']),
      { type: 'click', text: 'Edit filters...' },
      { type: 'waitForText', text: 'Filter options' },
      // focusing the value box shows its `*` placeholder
      { type: 'type', selector: 'input[maxlength="2"]', value: 'HP' },
      { type: 'press', key: 'Tab' },
      { type: 'delay', ms: 1000 },
    ],
  },

  // The session starts unsorted so the first frame shows the before state.
  {
    mode: 'url',
    name: 'alignments_sort_by_base',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:14470-14500',
      showCenterLine: true,
      tracks: ['volvox_bam'],
    }),
    readyText: 'ctgA',
    viewportWidth: 1100,
    // below 500 the context menu clips at the frame edge
    crop: { x: 0, y: 0, width: 1100, height: 500 },
    tooltip: 'hide',
    stages: [
      {
        actions: [
          // If this cascade times out with the anchor right, check that a
          // right-click anywhere in the track offers the item at all: a
          // fractional `bpAtPx` once broke it (29c7651d9f).
          { type: 'rightclick', anchor: SORT_COLUMN },
          ...menuCascade(['SNP/Mismatch', 'Sort by base at position']),
        ],
        annotations: [
          { type: 'box', anchor: { text: 'Sort by base at position' } },
          {
            type: 'text',
            anchor: { text: 'SNP/Mismatch' },
            // the label grows rightward from x, so this keeps it off the menu
            dx: -440,
            dy: -30,
            maxWidth: 270,
            text: 'Right-click a mismatch to sort reads by that base',
          },
        ],
      },
      {
        actions: [
          { type: 'click', text: 'Sort by base at position' },
          {
            type: 'waitForText',
            text: 'Sort by base at position',
            hidden: true,
          },
          PARK_CURSOR,
        ],
        annotations: [
          {
            type: 'text',
            anchor: SORT_COLUMN,
            dx: 60,
            dy: -20,
            maxWidth: 330,
            text: 'Reads sorted by base at this column',
          },
          {
            type: 'arrow',
            anchor: { ...SORT_COLUMN, dx: 12, dy: -18 },
            fromAnchor: { ...SORT_COLUMN, dx: 52, dy: -14 },
          },
        ],
      },
    ],
  },

  {
    mode: 'url',
    name: 'alignments_track_arcs',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      // B2M: one isoform and 3 introns, so the sashimi arcs are few
      loc: 'chr15:45,003,000-45,012,000',
      trackLabels: 'offset',
      tracks: [
        {
          trackId: 'ncbi_gff_hg19',
          height: 120,
        },
        {
          trackId: 'Pairend_StrandSpecific_51mer_Human_hg19',
          // featureSpacing is derived from mark.height, not a config slot, so
          // the display drops one added here
          sashimi: { labels: { show: true }, placement: 'auto' },
          pileup: { mark: { height: 1 } },
          coverage: { encoding: { y: { scale: { type: 'log' } } } },
        },
      ],
    }),
    readyText: 'B2M',
    readyTimeout: 60000,
  },

  {
    mode: 'url',
    name: 'hic_track',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr8:50,366,343-61,321,733',
      trackLabels: 'offset',
      tracks: [
        {
          trackId: 'ncbi_gff_hg19',
          showLabels: 'auto',
        },
        'hic',
      ],
    }),
    readySelector: displayPainted('hic-display'),
    readyTimeout: HIC_READY_TIMEOUT,
    slowLiveSession: false,
  },

  // Needs a file with inter-chromosomal blocks: the demo's hg19
  // intra_nofrag_30.hic holds only self-pairs. hic_gm12878_encode is ENCODE's
  // ENCFF563JTY cut to its 2.5 Mb binsize by
  // scripts/build_gm12878_wholegenome_hic.sh, so it never zooms finer.
  {
    mode: 'url',
    name: 'hic/whole_genome',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      // the 24 main chromosomes; alt contigs would take width as slivers
      displayedRegionNames: [
        ...Array.from({ length: 22 }, (_, i) => `chr${i + 1}`),
        'chrX',
        'chrY',
      ],
      trackLabels: 'offset',
      // The widest pair (chr1 x chrY) sets the wedge height, so below 700 the
      // figure is the pyramid's faint top slice. A log scale saturates this
      // file to solid red.
      tracks: [
        {
          trackId: 'hic_gm12878_encode',
          encoding: { color: { scale: { type: 'linear' } } },
          height: 700,
        },
      ],
    }),
    viewportHeight: 910,
    readySelector: displayPainted('hic-display'),
    readyTimeout: HIC_WHOLE_GENOME_READY_TIMEOUT,
    slowLiveSession: false,
  },

  // At the section's usual 11 Mb the off half is blank, so these use 4.2 Mb. A
  // compose has no annotation layer, so each half labels itself.
  ...(
    [
      ['hic/percentile_off', 1, 'Emphasize faint contacts OFF'],
      ['hic/percentile_on', 0.95, 'Emphasize faint contacts ON (the default)'],
    ] as const
  ).map(([name, domainQuantile, label]) => ({
    mode: 'url' as const,
    name,
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr8:52,000,000-56,200,000',
      trackLabels: 'offset',
      tracks: [
        {
          trackId: 'hic',
          encoding: { color: { scale: { domainQuantile } } },
          height: 330,
        },
      ],
    }),
    // the label anchors to the track's bottom, so the whole display must fit
    viewportHeight: 544,
    readySelector: displayPainted('hic-display'),
    readyTimeout: HIC_READY_TIMEOUT,
    slowLiveSession: false,
    annotations: [
      {
        type: 'text' as const,
        text: label,
        fontSize: 20,
        // the triangle leaves the bottom-left corner empty at any zoom
        anchor: {
          trackId: 'hic',
          alignX: 'left' as const,
          alignY: 'bottom' as const,
        },
        dx: 150,
        dy: -26,
      },
    ],
  })),
  {
    mode: 'compose',
    name: 'hic/faint_contacts',
    parts: ['hic/percentile_off', 'hic/percentile_on'],
  },

  {
    mode: 'url',
    name: 'hic/observed_expected',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr8',
      trackLabels: 'offset',
      tracks: [
        {
          trackId: 'hic',
          encoding: { color: 'observed/expected' },
          legend: { show: true },
        },
      ],
    }),
    viewportHeight: 530,
    readySelector: displayPainted('hic-display'),
    readyTimeout: HIC_READY_TIMEOUT,
    slowLiveSession: false,
  },
  {
    mode: 'url',
    name: 'hic/overlay_controls',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr8:50,366,343-61,321,733',
      trackLabels: 'offset',
      tracks: [
        {
          trackId: 'hic',
          legend: { show: true },
        },
      ],
    }),
    viewportHeight: 530,
    readySelector: displayPainted('hic-display'),
    readyTimeout: HIC_READY_TIMEOUT,
    slowLiveSession: false,
  },

  // A view cannot hold one trackId twice, so the modifications row is a
  // session copy of the config track.
  {
    mode: 'url',
    name: 'alignments/modifications2',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'human_chr20_mod_call_5mC_5hmC_CG_cram_modifications',
          name: 'human_chr20_mod_call_5mC_5hmC_CG (CRAM) (modifications)',
          assemblyNames: ['hg38'],
          adapter: {
            type: 'CramAdapter',
            cramLocation: {
              uri: 'https://jbrowse.org/genomes/GRCh38/methylation/human_chr20_mod_call_5mC_5hmC_CG.cram',
              locationType: 'UriLocation',
            },
            craiLocation: {
              uri: 'https://jbrowse.org/genomes/GRCh38/methylation/human_chr20_mod_call_5mC_5hmC_CG.cram.crai',
              locationType: 'UriLocation',
            },
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr20:19,742,000-19,778,000',
          tracks: [
            // on top, so the callouts on the CRAM rows don't cover it
            'cpgisland_ucsc_hg38',
            {
              trackId: 'human_chr20_mod_call_5mC_5hmC_CG_cram_modifications',
              pileup: {
                bases: { show: true, encoding: { color: 'modifications' } },
              },
              forceLoad: true,
            },
            {
              trackId: 'human_chr20_mod_call_5mC_5hmC_CG_cram',
              pileup: {
                bases: {
                  show: true,
                  encoding: { color: 'modifications' },
                  unmodified: { show: true },
                },
              },
              forceLoad: true,
            },
          ],
        },
      ],
    }),
    readyText: 'CpG',
    readyTimeout: 60000,
    tooltip: 'hide',
    viewportWidth: 2000,
    viewportHeight: 890,
    annotations: [
      {
        type: 'text',
        anchor: {
          selector:
            '[data-testid^="trackRenderingContainer-"][data-testid$="-human_chr20_mod_call_5mC_5hmC_CG_cram_modifications"]',
        },
        dx: 250,
        dy: -60,
        maxWidth: 340,
        fontSize: 16,
        // both callouts name their Color by... radio (baseLayerLabels.ts)
        text: `${MODIFICATIONS_LABEL}: only the calls in the MM tag`,
      },
      {
        type: 'text',
        anchor: {
          selector:
            '[data-testid^="trackRenderingContainer-"][data-testid$="-human_chr20_mod_call_5mC_5hmC_CG_cram"]',
        },
        dx: 250,
        dy: -60,
        maxWidth: 340,
        fontSize: 16,
        text: `${UNMODIFIED_IN_BLUE_LABEL}: every CpG, red methylated and blue not`,
      },
    ],
  },

  {
    mode: 'url',
    name: 'alignments/haplotype',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [HG002_NANOPORE_HP_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: '1:63,005,000-63,008,000',
          tracks: [
            {
              trackId: 'hg002_nanopore_hp',
              height: 500,
              forceLoad: true,
              facet: 'tags.HP',
              encoding: { color: 'tags.HP' },
            },
          ],
        },
      ],
    }),
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 90000,
    viewportHeight: 700,
  },

  {
    mode: 'url',
    name: 'alignments/haplotype_groupby',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [HG002_NANOPORE_HP_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: '1:63,005,000-63,008,000',
          tracks: [
            {
              trackId: 'hg002_nanopore_hp',
              height: 300,
              forceLoad: true,
              // ungrouped and uncolored until the dialog submits
            },
          ],
        },
      ],
    }),
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 90000,
    viewportHeight: 550,
    tooltip: 'hide',
    stages: [
      {
        actions: [
          {
            type: 'click',
            selector:
              '[data-testid="track_menu_icon"][data-trackid="hg002_nanopore_hp"]',
          },
          { type: 'waitForText', text: 'Group by...' },
          { type: 'hover', text: 'Group by...' },
          // "None" is the submenu's first radio, present even when ungrouped
          { type: 'waitForText', text: 'None' },
          { type: 'delay', ms: 800 },
        ],
        annotations: [
          { type: 'box', anchor: { text: 'Group by...' } },
          { type: 'box', anchor: { text: 'Tag...' } },
        ],
      },
      {
        actions: [
          { type: 'click', text: 'Tag...' },
          {
            type: 'waitForText',
            text: 'Renders the reads as stacked sections',
          },
          {
            type: 'type',
            selector: '[data-testid="group-tag-name-input"]',
            value: 'HP',
          },
          // let the optional "Found values" tag preview resolve
          { type: 'delay', ms: 1500 },
        ],
        annotations: [
          {
            type: 'box',
            pad: 2,
            anchor: { selector: '[data-testid="group-tag-name-input"]' },
          },
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // Alignments track interactions
  // ────────────────────────────────────────────────────────────────────────

  {
    mode: 'url',
    name: 'alignments/compact',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr1:161,172,613-161,181,745',
      tracks: [
        {
          trackId: 'illumina_hg002',
          pileup: { mark: { height: 3 } },
        },
      ],
    }),
    readyText: 'HG002',
    readyTimeout: 60000,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      ...menuCascade(['Read height', 'Compact']),
    ],
    annotations: [
      { type: 'box', anchor: { text: 'Read height' } },
      { type: 'box', anchor: { text: 'Compact' } },
    ],
  },

  // The menu half of `insertion`, whose Illumina track has soft clipping on.
  {
    mode: 'url',
    name: 'alignments/insertion_soft_clipping_menu',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: '1:55,705,770-55,706,090',
      highlight: [
        {
          refName: '1',
          start: 55_705_905,
          end: 55_705_907,
          label: 'Insertion',
        },
      ],
      tracks: [{ trackId: 'illumina_hg002', height: 320 }],
    }),
    readyText: 'HG002',
    readyTimeout: 60000,
    hideSelectors: ['.MuiTooltip-popper'],
    tooltip: 'hide',
    actions: [
      trackMenuIcon('illumina_hg002'),
      ...menuCascade(['Show...', 'Soft clipping']),
    ],
    annotations: cascadeBoxes(['Show...', 'Soft clipping']),
  },

  {
    mode: 'url',
    name: 'alignments/height_mode_fit',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr1:161,176,000-161,178,500',
      tracks: [
        {
          trackId: 'illumina_hg002',
          heightMode: 'fit',
          height: 260,
        },
      ],
    }),
    readyText: 'HG002',
    readyTimeout: 60000,
    viewportHeight: 560,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      ...menuCascade(['Read height', FIT_TO_TRACK_LABEL]),
    ],
    annotations: [
      { type: 'box', anchor: { text: 'Read height' } },
      { type: 'box', anchor: { text: FIT_TO_TRACK_LABEL } },
    ],
  },

  {
    mode: 'url',
    name: 'alignments/select_arc_display',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-50000',
      tracks: ['volvox_sv_cram'],
    }),
    readyText: 'ctgA',
    // room for the "Read connections" submenu
    viewportHeight: 600,
    // A `.MuiTooltip-popper` hideSelector hides the hovered button's tooltip
    // from the capture but not from the run's tooltip check.
    tooltip: 'hide',
    stages: [
      {
        actions: [
          { type: 'click', selector: '[data-testid="track_menu_icon"]' },
          ...menuCascade(['Read connections', 'Read arcs']),
        ],
        annotations: [{ type: 'box', anchor: { text: 'Read arcs' } }],
      },
      {
        // a checkbox row keeps the menu open
        actions: [
          { type: 'click', text: 'Read arcs' },
          { type: 'press', key: 'Escape' },
          { type: 'press', key: 'Escape' },
          // the Escapes see only the menu closing, not the display refetch
          { type: 'waitForAppSettled' },
        ],
        viewportHeight: 480,
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // RNA-seq tutorial
  // ────────────────────────────────────────────────────────────────────────

  {
    mode: 'url',
    name: 'rnaseq/basic',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr7:5,567,000-5,570,000',
      trackLabels: 'offset',
      tracks: [
        'ncbi_gff_hg19',
        {
          trackId: 'Pairend_StrandSpecific_51mer_Human_hg19',
          coverage: { height: 120 },
          pileup: { maxLayoutHeight: 2000 },
          filter: [{ field: 'junction.reads', gte: 3 }],
          height: 460,
        },
      ],
    }),
    readyText: 'ACTB',
    readyTimeout: 60000,
    viewportHeight: 800,
  },

  {
    mode: 'url',
    name: 'rnaseq/compact_stacked',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr7:5,566,500-5,570,500',
      trackLabels: 'offset',
      tracks: [
        'ncbi_gff_hg19',
        {
          trackId: 'Pairend_StrandSpecific_51mer_Human_hg19',
          pileup: { mark: { height: 3 }, maxLayoutHeight: 2000 },
          coverage: {
            height: 120,
          },
          // ACTB's forward-strand arcs are 1-2 read aligner noise; its real
          // junctions have 4 or more
          filter: [{ field: 'junction.reads', gte: 3 }],
          height: 420,
        },
      ],
    }),
    readyText: 'ACTB',
    readyTimeout: 60000,
    viewportHeight: 760,
  },

  {
    mode: 'url',
    name: 'rnaseq/longread_isoseq',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr7:5,566,000-5,571,000',
      trackLabels: 'offset',
      tracks: [
        'ncbi_gff_hg19',
        {
          trackId: 'hg_isoforms.fasta_bam',
          coverage: { height: 120 },
          pileup: { mark: { height: 1 } },
          height: 620,
        },
      ],
    }),
    readyText: 'ACTB',
    readyTimeout: 60000,
    viewportHeight: 960,
  },

  ...(
    [
      { suffix: 'file_order', display: {} },
      { suffix: 'spliced_first', display: { sort: 'spliced' } },
    ] as const
  ).map(({ suffix, display }) => ({
    mode: 'url' as const,
    name: `rnaseq/deep_pileup_${suffix}`,
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr7:5,566,500-5,570,500',
      trackLabels: 'offset' as const,
      tracks: [
        'ncbi_gff_hg19',
        {
          trackId: 'Pairend_StrandSpecific_51mer_Human_hg19',
          pileup: { mark: { height: 3 }, maxLayoutHeight: 2000 },
          coverage: { height: 120 },
          filter: [{ field: 'junction.reads', gte: 3 }],
          height: 420,
          ...display,
        },
      ],
    }),
    readyText: 'ACTB',
    readyTimeout: 60000,
    // 760 clips the bottom
    viewportHeight: 772,
  })),

  {
    mode: 'compose',
    name: 'rnaseq/sort_spliced_first',
    parts: [
      'rnaseq/deep_pileup_file_order',
      'rnaseq/deep_pileup_spliced_first',
    ],
  },

  // No `minReads` here: the support floor would remove most of what the motif
  // filter removes.
  ...(
    [
      { suffix: 'all_junctions', display: {} },
      {
        suffix: 'canonical_only',
        display: {
          filter: [{ field: 'junction.canonical', equal: true }],
        },
      },
    ] as const
  ).map(({ suffix, display }) => ({
    mode: 'url' as const,
    name: `rnaseq/sashimi_${suffix}`,
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr7:5,566,500-5,570,500',
      trackLabels: 'offset' as const,
      tracks: [
        'ncbi_gff_hg19',
        {
          trackId: 'Pairend_StrandSpecific_51mer_Human_hg19',
          pileup: { mark: { height: 3 }, maxLayoutHeight: 2000 },
          coverage: { height: 160 },
          height: 380,
          ...display,
        },
      ],
    }),
    readyText: 'ACTB',
    readyTimeout: 60000,
    // 720 clips the bottom
    viewportHeight: 732,
  })),

  {
    mode: 'compose',
    name: 'rnaseq/hide_non_canonical',
    parts: ['rnaseq/sashimi_all_junctions', 'rnaseq/sashimi_canonical_only'],
  },

  // Built by scripts/build_rnaseq_junctions.sh.
  {
    mode: 'url',
    name: 'rnaseq/junction_track',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr11:49,220,500-49,231,500',
      trackLabels: 'offset',
      tracks: ['ncbi_gff_hg19', 'rnaseq_junctions_hg19'],
    }),
    readyText: 'FOLH1',
    readyTimeout: 60000,
    viewportHeight: 528,
  },

  strandSpecificSpec(),

  // NELFE(-) abutting SKIV2L(+). Rejected loci: surfeit (RPL7A dwarfs SURF1),
  // GAPDH (intronic spikes), HSPA1L/HSPA1B (long gap), C6orf47/GPANK1
  // (antisense muddies the switch).
  {
    mode: 'url',
    name: 'rnaseq/strand_split_coverage',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr6:31,920,500-31,933,000',
      tracks: [
        { trackId: 'ncbi_gff_hg19', height: 90 },
        {
          trackId: 'Pairend_StrandSpecific_51mer_Human_hg19',
          // grouping on raw read strand sends the two mates of a pair to
          // opposite sections in this stranded paired-end library
          facet: 'firstOfPairStrand',
          encoding: { color: 'firstOfPairStrand' },
          pileup: { mark: { height: 3 } },
          sashimi: { show: false },
          coverage: { height: 110 },
          height: 560,
        },
      ],
    }),
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 90000,
    viewportHeight: 890,
    tooltip: 'hide',
  },
]
