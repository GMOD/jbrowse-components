import { displayPainted, displaySettled } from '@jbrowse/browser-test-utils'

import {
  HG38_HS1_CONFIG,
  UCSC_HG38_CONFIG,
  VOLVOX,
  menuCascade,
  sessionSpec,
  CGIAB_CONFIG,
  HPYLORI_CONFIG,
} from '../screenshot-spec-helpers.ts'
import { junctionScaffold, scaffoldOverview } from './cgiab-junction.ts'
import {
  ECOLI_AVA_STACK_HEIGHT,
  ECOLI_DEMO_BASE,
  ecoliAvaStack,
} from './demoBase.ts'
import { PORTAL_LOCI, portalHaplotypeLanes } from './genomes_pangenome.ts'
import { GRAPH_VIEW_DRAWN, referencePositionColor } from './graph-fixtures.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The paa island's graph slice and the segments lane over it share one ramp.
const PAA_COLOR_DOMAIN = { start: 1445000, end: 1474500 }

// Down the tree from human, so breaks and flips grow top to bottom.
const HG38_VERTEBRATES_TREE_ORDER = [
  'panTro6',
  'gorGor6',
  'ponAbe3',
  'rheMac10',
  'calJac4',
  'mm39',
  'canFam6',
  'bosTau9',
]

export const DOTPLOT_CONFIG = 'test_data/config_dotplot.json'
export const HS1_MM39_CONFIG = 'test_data/hs1_vs_mm39/config.json'
const AMYLASE_CONFIG = 'test_data/amylase/config.json'
// scripts/build_grape_peach_cacao_synteny.sh, which also hosts the pairwise
// grape-peach anchors that mcscan_synteny_grape_peach.md loads
const GRAPE_PEACH_CONFIG =
  'https://jbrowse.org/demos/grape_peach_cacao/config.json'
const GRAPE = 'GCF_030704535.1'
const PEACH = 'GCF_000346465.2'
const T2T_APES_CACTUS_CONFIG =
  'https://jbrowse.org/demos/t2t_apes_cactus/config.json'
const SYRI_CONFIG = 'test_data/syri/config.json'
// SyRI's types in plotsr's order
const SYRI_ACCESSIONS = ['Col-0', 'Ler', 'Cvi', 'Eri', 'Kyo', 'Sha']
const SYRI_TYPES = ['SYN', 'INV', 'TRANS', 'INVTR', 'DUP', 'INVDP']
const AMYLASE_HG38 = 'chr1:103,520,894-103,832,637'

// `geneColor` lands on all three gene tracks; in bacteria the `gene` attribute
// is the ortholog id, so one symbol takes one color in every panel. Leaving it
// unset keeps the URL byte-identical to the published figure.
export function hpyloriSyntenyWithGenes({
  geneColor,
}: { geneColor?: { field: string } } = {}) {
  const geneTrack = (trackId: string) => ({
    trackId,
    filter: ['geneLike'],
    // a key per panel lists a different subset and covers the right-edge genes
    ...(geneColor
      ? { encoding: { color: geneColor }, legend: { show: false } }
      : {}),
  })
  return sessionSpec(HPYLORI_CONFIG, {
    views: [
      {
        type: 'LinearSyntenyView',
        mark: { interpolate: 'bump' },
        // a flat string[] puts every track on level 0 and leaves level 1 empty
        tracks: [['26695_vs_chc155.pif'], ['chc155_vs_j99.pif']],
        views: [
          {
            // 26695 runs opposite to the other strains here; [rev] straightens
            // the level-0 ribbons so only J99's inversion crosses
            loc: 'NC_018939v1:1489400-1509400[rev]',
            assembly: 'GCF_000307795.1',
            tracks: [geneTrack('GCF_000307795.1-ncbiGff')],
          },
          {
            loc: 'NZ_AP026446v1:99000-119000',
            assembly: 'GCF_025998455.1',
            tracks: [geneTrack('GCF_025998455.1-ncbiGff')],
          },
          {
            loc: 'NZ_CP011330v1:1238100-1258100',
            assembly: 'GCF_000982695.1',
            tracks: [geneTrack('GCF_000982695.1-ncbiGff')],
          },
        ],
      },
    ],
  })
}

export const HG38_PANTRO6_CONFIG = 'test_data/hg38_panTro6_synteny/config.json'

// An RB1 intron holds a full-length human L1HS absent from the chimp ortholog,
// flanked by repeats both species share.
export const RB1_L1_LOCUS = {
  hg38: 'chr13:48,459,000-48,477,500',
  panTro6: 'chr13:29,450,000-29,459,000',
}

// A human-specific AluYb8 in PICALM, downstream of an AluY chimp shares.
export const PICALM_ALU_LOCUS = {
  hg38: 'chr11:85,978,000-85,986,000',
  panTro6: 'chr11:81,727,500-81,735,000',
}

// A hosted liftOver chain is one chromosome-scale block, so zooming in on it
// exercises the worker's oversized-block clip.
export function hg38ChimpSynteny(
  locus: { hg38: string; panTro6: string } = RB1_L1_LOCUS,
) {
  // panTro6 has no MANE, so 'longestCoding' cuts the isoform stacks. Pinning a
  // featureHeight draws each short exon as a square beside flat repeat bars.
  const genes = (id: string) => ({
    trackId: id,
    geneGlyphMode: 'longestCoding',
    heightMode: 'grow',
  })
  // 'fit' inflates the boxes and drops labels; the repeat names are the point.
  // `compact` is the densest mode that still draws them; `collapsed` does not.
  const rmsk = (id: string) => ({
    trackId: id,
    heightMode: 'grow',
    displayMode: 'compact',
  })
  return sessionSpec(HG38_PANTRO6_CONFIG, {
    views: [
      {
        type: 'LinearSyntenyView',
        mark: { interpolate: 'bump' },
        tracks: [['hg38_panTro6_synteny']],
        views: [
          {
            assembly: 'hg38',
            loc: locus.hg38,
            // RepeatMasker next to the synteny band, where it meets the indels
            tracks: [genes('hg38-genes'), rmsk('hg38-rmsk')],
            trackLabels: 'offset',
          },
          {
            assembly: 'panTro6',
            loc: locus.panTro6,
            tracks: [rmsk('panTro6-rmsk'), genes('panTro6-genes')],
            trackLabels: 'offset',
          },
        ],
      },
    ],
  })
}

// PAR1 to the end of the euchromatic MSY: what the self-alignment covers.
const CHRY_MSY_LOCUS = 'chrY:2,700,000-26,600,000'

// The P1-P5 Yq palindromes (Rhie et al. 2023), shared by the dotplot's box and
// the synteny view so both figures frame one interval.
const CHRY_YQ_PALINDROMES = 'chrY:21,200,000-26,000,000'

// The 401,640 bp inverted self-alignment at chrY:22,368,211-22,769,851 (the
// RBMY1 palindrome), with ~30 kb of flank.
const CHRY_P_PALINDROME_WINDOW = 'chrY:22,330,000-22,810,000'

// The GFF is keyed on RefSeq accessions; the fixture's `refNameAliases` maps
// them to chrY, without which this lane draws nothing.
const CHRY_GENE_LANE = {
  trackId: 'hs1_chrY_genes',
  filter: ['geneLike'],
  geneGlyphMode: 'longestCoding',
  displayMode: 'compact',
  // 'auto' adds RefSeq's sentence-long descriptions at this density
  showLabels: 'name',
  height: 60,
}

const LINC01150_BAND = { label: 'LINC01150', color: 'rgba(120,80,200,0.14)' }

function tnnt3Session(
  view: Record<string, unknown> = {},
  { markLinc01150 = false } = {},
) {
  const band = (assemblyName: string, start: number, end: number) =>
    markLinc01150
      ? {
          highlight: [
            { refName: 'chr11', start, end, assemblyName, ...LINC01150_BAND },
          ],
        }
      : {}
  return sessionSpec(HG38_HS1_CONFIG, {
    views: [
      {
        type: 'LinearSyntenyView',
        encoding: { color: 'strand' },
        tracks: [['hg38_hs1_synteny']],
        ...view,
        views: [
          {
            assembly: 'hg38',
            loc: 'chr11:1,881,000-1,955,000',
            tracks: [{ trackId: 'hg38-genes', geneGlyphMode: 'longestCoding' }],
            trackLabels: 'offset',
            ...band('hg38', 1_897_015, 1_908_656),
          },
          {
            // the hg38 window shifted by the +83.7 kb hg38->hs1 offset
            assembly: 'hs1',
            loc: 'chr11:1,964,700-2,038,700',
            // the hs1 GFF carries regulatory features alongside the genes
            tracks: [
              {
                trackId: 'hs1-genes',
                geneGlyphMode: 'longestCoding',
                filter: ['geneLike'],
              },
            ],
            trackLabels: 'offset',
            ...band('hs1', 2_011_880, 2_023_477),
          },
        ],
      },
    ],
  })
}

// The hg38 pair matches what the launch copies from the launching LGV, so the
// two bottom frames differ only in the chimp panel. The heights hold both
// frames to one height.
const FTO_PANEL_TRACKS = {
  hg38: [
    {
      trackId: 'hg38-ncbiRefSeqCurated',
      geneGlyphMode: 'longestCoding',
      height: 60,
    },
    {
      trackId: 'hg38-rmsk',
      displayMode: 'compact',
      height: 72,
    },
  ],
  // chimp's RefSeq Curated is empty in this window
  panTro6: [
    {
      trackId: 'panTro6-ncbiRefSeq',
      geneGlyphMode: 'longestCoding',
      height: 60,
    },
    {
      trackId: 'panTro6-rmsk',
      displayMode: 'compact',
      height: 72,
    },
  ],
}

const TNNT3_FRAME = {
  mode: 'url' as const,
  viewportWidth: 1200,
  viewportHeight: 520,
  readySelector: displayPainted('synteny_canvas'),
  readyTimeout: 120000,
}

const TNNT3_GENE_ORDER_PAGE =
  'https://staging.genomes.jbrowse.org/conserved-gene-order/?gene=TNNT3&ref=9606'
const STAR_LINK = 'a[title^="One lane per genome"]'

// All eight lanes but platypus store this region forward, so a blue ribbon is
// an inversion against hg38. Swapping a lane can break that.
function tnnt3StarSession() {
  const lanes = [
    'panTro6',
    'ponAbe3',
    'rheMac10',
    'GCF_040939455.1',
    'GCA_033439345.1',
    'hetGla2',
    'loxAfr3',
    'GCF_004115215.2',
  ]
  return sessionSpec('https://jbrowse.org/ucsc/hg38/config-staging.json', {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'hg38',
        loc: 'NC_000011.10:1822626-2024102',
        tracks: [
          {
            trackId: 'hg38_liftOver_multiway',
            rows: { sort: lanes, kept: lanes },
            ribbons: { encoding: { color: 'strand' } },
            height: (lanes.length + 1) * 60,
          },
        ],
      },
    ],
  })
}

function hostedStarSession(
  db: string,
  loc: string,
  lanes: string[],
  display: Record<string, unknown> = {},
  genes: Record<string, unknown> = {},
) {
  return sessionSpec(`https://jbrowse.org/ucsc/${db}/config-staging.json`, {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: db,
        loc,
        tracks: [
          { trackId: `${db}-ncbiRefSeq`, ...genes },
          {
            trackId: `${db}_liftOver_multiway`,
            rows: { sort: lanes, kept: lanes },
            height: (lanes.length + 1) * 34,
            ...display,
          },
        ],
      },
    ],
  })
}

// The window spans seven consecutive MCScan blocks out of .anchors.simple; a
// one-block window draws `.anchors.simple` as a single slab.
function mcscanFilePartSpecs(): ScreenshotSpec[] {
  // blocks first in the level so the gene threads paint on top
  const part = (name: string, trackIds: string[], label: string) => ({
    mode: 'url' as const,
    name,
    url: sessionSpec(GRAPE_PEACH_CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: [trackIds],
          mark: { interpolate: 'linear' },
          levelHeights: [260],
          collapseEmptyRows: true,
          views: [
            {
              assembly: GRAPE,
              loc: 'chr9:1-11,300,000',
              tracks: [],
            },
            {
              assembly: PEACH,
              loc: 'chrG3:2,150,000-7,300,000',
              tracks: [],
            },
          ],
        },
      ],
    }),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 60000,
    viewportHeight: 445,
    annotations: [
      {
        type: 'text' as const,
        x: 24,
        y: 56,
        fontSize: 22,
        maxWidth: 700,
        text: label,
      },
    ],
  })
  return [
    part(
      'mcscan_synteny/anchors',
      ['grape_peach_anchors'],
      '.anchors open; one ribbon per gene pair',
    ),
    part(
      'mcscan_synteny/anchors_simple',
      ['grape_peach_anchors_simple', 'grape_peach_anchors'],
      '.anchors and .anchors.simple open; one ribbon per gene\nrendered on top of chained synteny blocks',
    ),
  ]
}

const ECOLI_STRAINS = ['K12', 'Sakai', 'CFT073', 'NCTC86', 'IAI39']
const ECOLI_IDENTITY_TRACK = {
  type: 'SyntenyTrack',
  trackId: 'ecoli_ava_identity',
  name: 'K-12 against each strain, identity',
  assemblyNames: ECOLI_STRAINS,
  adapter: {
    type: 'MultiGenomePAFAdapter',
    uri: 'https://jbrowse.org/demos/ecoli_pangenome/all_vs_all.paf.gz',
    assemblyNames: ECOLI_STRAINS,
  },
  displays: [
    {
      type: 'LinearMarkDisplay',
      displayId: 'ecoli_ava_identity-LinearMarkDisplay',
      rows: 'mate.assemblyName',
      filter: ["jexl:feature.mate.assemblyName != 'K12'"],
      encoding: { y: { scale: { zero: false } } },
      marks: [{ mark: 'rule', encoding: { y: 'identity', strokeWidth: 2 } }],
    },
  ],
}

// Shared with `syntenyVideoFixtures.allVsAllLanes`. The launch needs a plain
// LGV: a rubberband in a LinearSyntenyView row offers no Launch submenu.
const ECOLI_ONE_VS_ALL_LANES = sessionSpec(
  'https://jbrowse.org/demos/ecoli_pangenome/config.json',
  {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'K12',
        loc: 'chr:795,000-815,000',
        tracks: [
          {
            trackId: 'ecoli_ava',
            facet: { field: 'mateAssembly', hidden: ['K12'] },
            pileup: { mark: { height: 14 } },
            height: 135,
          },
        ],
      },
    ],
  },
)

// The segments lane rides into the graph launch on the stack's K-12 row.
// The window covers K-12 chr:807,327, where all_vs_all.paf breaks Sakai's
// alignment around a 38.5 kb phage insert.
const ECOLI_ROUND_TRIP_START = sessionSpec(
  'https://jbrowse.org/demos/ecoli_pangenome/config.json',
  {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'K12',
        loc: 'chr:783,000-832,000',
        tracks: [
          {
            trackId: 'ecoli_ava',
            facet: { field: 'mateAssembly', hidden: ['K12'] },
            pileup: { mark: { height: 14 } },
            height: 135,
          },
          {
            trackId: 'ecoli_minigraph_segments',
            type: 'LinearBasicDisplay',
            showLabels: 'none',
            height: 60,
          },
        ],
      },
    ],
  },
)

// The MAF menu lists only strains with a row under the drag, so the window must
// hold blocks carrying all five; inside an accessory island it lists one.
const ECOLI_MAF_ROWS = sessionSpec(
  'https://jbrowse.org/demos/ecoli_pangenome/config.json',
  {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'K12',
        loc: 'chr:800,100-804,300',
        tracks: [
          {
            trackId: 'K12_genes',
            filter: ['geneLike'],
            displayMode: 'compact',
          },
          // at the default height each strain row is too thin to aim a drag at
          {
            trackId: 'ecoli_pggb_maf',
            axis: { tree: true },
            height: 150,
          },
        ],
      },
    ],
  },
)

// Shared by the `multiway_synteny/grasses_rice_lanes` still and the launch tour.
const GRASSES_RICE_LANES = sessionSpec(
  'https://jbrowse.org/demos/orthofinder_grasses/config.json',
  {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'rice',
        loc: '3:31,590,000-31,775,000',
        tracks: [
          {
            trackId: 'rice_genes',
            filter: ['geneLike'],
            displayMode: 'compact',
          },
          {
            trackId: 'grasses_orthogroups',
            type: 'MultiWaySyntenyDisplay',
            rows: { sort: ['sorghum', 'brachypodium', 'setaria', 'maize'] },
            height: 320,
          },
        ],
      },
    ],
  },
)

const LGV_TRACK_ZOOM_SESSION = sessionSpec(
  'https://jbrowse.org/demos/grape_peach_cacao/config.json',
  {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'GCF_030704535.1',
        loc: 'chr11:828,000-866,000',
        tracks: [
          {
            trackId: 'GCF_030704535.1-ncbiRefSeq',
            filter: ['geneLike'],
            displayMode: 'compact',
            showLabels: 'auto',
          },
          {
            trackId: 'grape_peach_cacao_blocks',
            type: 'MultiWaySyntenyDisplay',
            rows: {
              sort: [
                'GCF_000346465.2',
                'GCF_000208745.1',
                'poplar',
                'citrus',
                'arabidopsis',
                'tomato',
              ],
            },
            height: 340,
          },
        ],
      },
    ],
  },
)

// Each frame replays the actions before it, since a capture is one page load.
function launchFromSelectionParts(): ScreenshotSpec[] {
  const url = ECOLI_ONE_VS_ALL_LANES
  // Menu rows go by testid: the track's name is also its label in the view, and
  // a text match resolves to that label first.
  const select = [
    { type: 'drag' as const, from: { x: 375, y: 150 }, to: { x: 975, y: 150 } },
    {
      type: 'waitForSelector' as const,
      selector: '[data-testid="cascading-submenu-launch"]',
    },
    {
      type: 'click' as const,
      selector: '[data-testid="cascading-submenu-launch"]',
    },
    {
      type: 'waitForSelector' as const,
      selector: '[data-testid="cascading-menuitem-linear_synteny_view"]',
    },
    { type: 'delay' as const, ms: 500 },
  ]
  const openDialog = [
    {
      type: 'click' as const,
      selector: '[data-testid="cascading-menuitem-linear_synteny_view"]',
    },
    { type: 'waitForText' as const, text: 'Panels, top to bottom' },
    { type: 'delay' as const, ms: 4000 },
  ]
  const base = {
    mode: 'url' as const,
    url,
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 120000,
  }
  return [
    {
      ...base,
      name: 'multiway_synteny/ecoli_launch_selection',
      viewportHeight: 420,
      actions: select,
    },
    {
      ...base,
      name: 'multiway_synteny/ecoli_launch_result',
      viewportHeight: 620,
      actions: [
        ...select,
        ...openDialog,
        // The run's `no longer part of a state tree` warns come from this
        // click and are benign: the replaced LGV's observers read dead nodes
        // once before React unmounts them.
        { type: 'click', text: 'Replace current view' },
        {
          type: 'waitForSelector',
          selector: displayPainted('synteny_canvas'),
        },
      ],
    },
  ]
}

// Three of oat's seven groups: the whole genome is a 21x21 grid of few-pixel
// cells, and off-group cells show up in any subset.
const OAT_HOMOEOLOG_GROUPS = [
  '4A',
  '4C',
  '4D',
  '5A',
  '5C',
  '5D',
  '7A',
  '7C',
  '7D',
]

// Most peach chr1 anchors have their grape mate off grape chr1 (the gamma
// paleohexaploidy), which is what the off-screen mate marks draw.
function peachGrapeChr1({
  marks,
  peachLoc = 'chrG1',
  grapeLoc = 'chr1',
}: { marks?: boolean; peachLoc?: string; grapeLoc?: string } = {}) {
  return sessionSpec(
    'https://jbrowse.org/demos/grape_peach_cacao/config.json',
    {
      views: [
        {
          type: 'LinearSyntenyView',
          // marks are on by default, so only the off state needs stating
          ...(marks ? {} : { offscreen: { show: false } }),
          views: [
            {
              assembly: 'GCF_000346465.2',
              loc: peachLoc,
              hideNoTracksActive: true,
            },
            {
              assembly: 'GCF_030704535.1',
              loc: grapeLoc,
              hideNoTracksActive: true,
            },
          ],
          tracks: [['grape_peach_cacao_blocks']],
        },
      ],
    },
  )
}

export function ecoliOneVsAllUrl(levelHeight: number) {
  return sessionSpec('https://jbrowse.org/demos/ecoli_pangenome/config.json', {
    views: [
      {
        type: 'LinearSyntenyView',
        views: [
          {
            assembly: 'K12',
            loc: 'chr:1-4,641,652',
            tracks: [
              {
                trackId: 'ecoli_ava',
                // `minimap2 -X` built the PAF, so the K12 lane would be empty
                facet: { field: 'mateAssembly', hidden: ['K12'] },
                pileup: {
                  // at 3.2kb/px the SNPs, each at a 1px floor, paint a solid wall
                  mismatches: { show: false },
                  // the gaps are the information; a 7px bar hides them
                  mark: { height: 20 },
                },
                height: 100,
              },
            ],
          },
          // IAI39 must sit next to K12 for a K12<->IAI39 band to exist
          { assembly: 'IAI39' },
          { assembly: 'Sakai' },
          { assembly: 'CFT073' },
          { assembly: 'NCTC86' },
        ],
        tracks: ['ecoli_ava'],
        mark: { interpolate: 'linear' },
        // matches the lanes, which color by strand
        encoding: { color: 'strand' },
        filter: [{ field: 'length', gte: 10000 }],
        collapseEmptyRows: true,
        levelHeights: [levelHeight, levelHeight, levelHeight, levelHeight],
      },
    ],
  })
}

export const syntenySpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'synteny_offscreen_mates',
    url: peachGrapeChr1({ marks: true }),
    viewportWidth: 1400,
    viewportHeight: 424,
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
    annotations: [
      {
        type: 'text',
        text: 'peach alignments whose grape end is on another chromosome',
        fontSize: 18,
        maxWidth: 300,
        leader: true,
        anchor: {
          view: [0, 0],
          loc: 'chrG1:6,000,000',
          alignY: 'bottom',
          dy: 8,
        },
        dx: 60,
        dy: -45,
      },
    ],
  },

  // also guards the oversized-block clip: a blank canvas here means it broke
  {
    mode: 'url',
    name: 'synteny_human_chimp_cigar_modes',
    url: hg38ChimpSynteny(),
    viewportWidth: 1200,
    viewportHeight: 691,
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 60000,
  },
  {
    mode: 'url',
    name: 'synteny_te_picalm_alu',
    url: hg38ChimpSynteny(PICALM_ALU_LOCUS),
    viewportWidth: 1200,
    viewportHeight: 667,
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 60000,
  },

  {
    mode: 'url',
    name: 'dotplot',
    // The median block is 675 bp, so any length floor thins the diagonals,
    // which are made of sub-pixel dots.
    url: sessionSpec(DOTPLOT_CONFIG, {
      views: [
        {
          type: 'DotplotView',
          views: [{ assembly: 'peach' }, { assembly: 'grape' }],
          tracks: ['grape_peach_paf'],
          filter: [{ field: 'length', gte: 0 }],
        },
      ],
    }),
    readySelector: displayPainted('dotplot_webgl_canvas'),
    readyTimeout: 60000,
  },

  {
    mode: 'url',
    name: 'linear_synteny',
    url: sessionSpec(DOTPLOT_CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['grape_peach_synteny_mcscan'],
          mark: { interpolate: 'linear' },
          encoding: { color: 'query', opacity: 0.8 },
          // the launch init reads levelHeights, not a `levels` snapshot
          levelHeights: [360],
          autoDiagonalize: true,
          views: [{ assembly: 'peach' }, { assembly: 'grape' }],
        },
      ],
    }),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 60000,
  },

  {
    mode: 'url',
    name: 'multiway_synteny/grape_peach_cacao',
    // Row order peach / cacao / grape: diagonalize cascades top-down and only
    // cleans a ~1:1 pair, so cacao-grape goes last where nothing re-scrambles it.
    url: sessionSpec(
      'https://jbrowse.org/demos/grape_peach_cacao/config.json',
      {
        views: [
          {
            type: 'LinearSyntenyView',
            views: [
              { assembly: 'GCF_000346465.2' },
              { assembly: 'GCF_000208745.1' },
              { assembly: 'GCF_030704535.1' },
            ],
            tracks: ['grape_peach_cacao_blocks'],
            encoding: { color: 'reference' },
            autoDiagonalize: true,
            collapseEmptyRows: true,
          },
        ],
      },
    ),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
    viewportHeight: 433,
  },

  {
    mode: 'url',
    name: 'multiway_synteny/grape_peach_cacao_gene_orthologs',
    viewportHeight: 822,
    url: sessionSpec(
      'https://jbrowse.org/demos/grape_peach_cacao/config.json',
      {
        views: [
          {
            type: 'LinearSyntenyView',
            views: [
              {
                assembly: 'GCF_000346465.2',
                loc: 'chrG7:18,565,100-18,700,100',
                tracks: [
                  {
                    trackId: 'GCF_000346465.2-ncbiRefSeq',
                    filter: ['geneLike'],
                    displayMode: 'compact',
                    showLabels: 'auto',
                  },
                ],
              },
              {
                assembly: 'GCF_030704535.1',
                loc: 'chr11:787,000-914,000',
                tracks: [
                  {
                    trackId: 'GCF_030704535.1-ncbiRefSeq',
                    filter: ['geneLike'],
                    displayMode: 'compact',
                    showLabels: 'auto',
                  },
                ],
              },
              {
                assembly: 'GCF_000208745.1',
                loc: 'chr9:3,898,700-4,003,700',
                tracks: [
                  {
                    trackId: 'GCF_000208745.1-ncbiRefSeq',
                    filter: ['geneLike'],
                    displayMode: 'compact',
                    showLabels: 'auto',
                  },
                ],
              },
            ],
            tracks: ['grape_peach_cacao_blocks'],
            mark: { interpolate: 'bump' },
            encoding: { color: 'syntenicDepth' },
          },
        ],
      },
    ),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
    // The ribbon fan is real: four grape TMTT synthase copies share one peach
    // and one cacao mate. The windows start past a second array (grape
    // 774-784 kb) that would paint the same dark orange from the left edge.
    annotations: [
      {
        type: 'text',
        text: 'grape TMTT synthase array: tandem copies against one peach and one cacao gene',
        fontSize: 18,
        maxWidth: 300,
        leader: true,
        dx: 90,
        anchor: {
          // without the view path the anchor resolves against peach, on top
          view: [0, 1],
          trackId: 'GCF_030704535.1-ncbiRefSeq',
          loc: 'chr11:863,000',
          fracY: 0.5,
        },
      },
    ],
  },

  {
    mode: 'url',
    name: 'multiway_synteny/blocks_one_vs_all',
    url: sessionSpec(
      'https://jbrowse.org/demos/grape_peach_cacao/config.json',
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'GCF_030704535.1',
            loc: 'chr11:778,000-866,000',
            tracks: [
              {
                trackId: 'GCF_030704535.1-ncbiRefSeq',
                filter: ['geneLike'],
                displayMode: 'compact',
                showLabels: 'auto',
              },
              {
                trackId: 'grape_peach_cacao_blocks',
                facet: 'mateAssembly',
                pileup: {
                  mark: { height: 14 },
                },
                // six lanes; any shorter clips the last one
                height: 140,
              },
            ],
          },
        ],
      },
    ),
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 120000,
    viewportHeight: 478,
  },

  // The domain orders lanes by how much of the block each keeps: a ribbon only
  // joins adjacent lanes, so a sparse lane mid-stack cuts every chain below it.
  {
    mode: 'url',
    name: 'multiway_synteny/lgv_track_lanes',
    url: sessionSpec(
      'https://jbrowse.org/demos/grape_peach_cacao/config.json',
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'GCF_030704535.1',
            loc: 'chr11:778,000-866,000',
            tracks: [
              {
                trackId: 'GCF_030704535.1-ncbiRefSeq',
                filter: ['geneLike'],
                displayMode: 'compact',
                showLabels: 'auto',
              },
              {
                trackId: 'grape_peach_cacao_blocks',
                type: 'MultiWaySyntenyDisplay',
                rows: {
                  sort: [
                    'GCF_000346465.2',
                    'GCF_000208745.1',
                    'poplar',
                    'citrus',
                    'arabidopsis',
                    'tomato',
                  ],
                },
                height: 340,
              },
            ],
          },
        ],
      },
    ),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 120000,
    viewportHeight: 680,
  },

  {
    mode: 'url',
    name: 'multiway_synteny/lgv_track_lanes_colored',
    url: sessionSpec(
      'https://jbrowse.org/demos/grape_peach_cacao/config.json',
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'GCF_030704535.1',
            loc: 'chr11:778,000-866,000',
            tracks: [
              {
                trackId: 'GCF_030704535.1-ncbiRefSeq',
                filter: ['geneLike'],
                displayMode: 'compact',
                showLabels: 'auto',
              },
              {
                trackId: 'grape_peach_cacao_blocks',
                type: 'MultiWaySyntenyDisplay',
                rows: {
                  sort: [
                    'GCF_000346465.2',
                    'GCF_000208745.1',
                    'poplar',
                    'citrus',
                    'arabidopsis',
                    'tomato',
                  ],
                },
                ribbons: { encoding: { color: 'strand' } },
                height: 340,
              },
            ],
          },
        ],
      },
    ),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 120000,
    viewportHeight: 692,
  },

  // The click lands in the grape-peach gutter at a gene the whole stack chains
  // through.
  {
    mode: 'url',
    name: 'multiway_synteny/lgv_track_clicked',
    url: LGV_TRACK_ZOOM_SESSION,
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 120000,
    viewportHeight: 680,
    tooltip: 'hide',
    clicksChange:
      "select a ribbon, outlining its ortholog group and opening the pair's details",
    actions: [
      {
        type: 'click',
        anchor: {
          loc: 'chr11:836,500',
          trackId: 'grape_peach_cacao_blocks',
          fracY: 0.15,
        },
      },
    ],
  },

  {
    mode: 'url',
    name: 'pangenome/hprc_cfhr_lanes',
    url: portalHaplotypeLanes(PORTAL_LOCI.cfhr),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 240000,
    viewportHeight: 560,
  },

  {
    mode: 'url',
    name: 'multiway_synteny/ecoli_island_lanes',
    url: sessionSpec('https://jbrowse.org/demos/ecoli_pangenome/config.json', {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:1,436,000-1,484,000',
          // the view's gridlines hold only for the anchor lane
          axis: { grid: false },
          tracks: [
            // at 60 px the five-to-two depth drop reads as a hairline
            { trackId: 'ecoli_pggb_depth', height: 120 },
            {
              trackId: 'ecoli_ava',
              type: 'MultiWaySyntenyDisplay',
              rows: { sort: ['NCTC86', 'CFT073', 'Sakai', 'IAI39'] },
              height: 340,
              encoding: {
                color: {
                  field:
                    "jexl:feature.name && (startsWith(feature.name,'paa') || startsWith(feature.name,'fea') || feature.name == 'tynA') ? 'island' : 'other'",
                  scale: {
                    domain: ['island', 'other'],
                    range: ['#d62728', 'goldenrod'],
                    names: ['feaR, tynA, paa operon', 'other genes'],
                  },
                  legend: { title: 'K-12 island genes' },
                },
              },
            },
          ],
        },
      ],
    }),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 120000,
    viewportHeight: 712,
  },

  {
    mode: 'url',
    name: 'multiway_synteny/vertebrate_hox_lanes',
    url: sessionSpec(
      'https://jbrowse.org/demos/orthofinder_vertebrates/config.json',
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'human',
            loc: '2:176,090,000-176,290,000',
            tracks: [
              {
                trackId: 'human_genes',
                filter: ['geneLike'],
                displayMode: 'compact',
              },
              {
                trackId: 'vertebrates_orthogroups',
                type: 'MultiWaySyntenyDisplay',
                rows: { sort: ['chicken', 'frog', 'gar', 'zebrafish'] },
                height: 320,
              },
            ],
          },
        ],
      },
    ),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 120000,
    viewportHeight: 660,
  },

  {
    mode: 'url',
    name: 'multiway_synteny/solanaceae_lanes',
    url: sessionSpec(
      'https://jbrowse.org/demos/orthofinder_solanaceae/config.json',
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'tomato',
            loc: 'SL4.0ch04:62,880,000-63,037,000',
            tracks: [
              {
                trackId: 'tomato_genes',
                filter: ['geneLike'],
                displayMode: 'compact',
                // Ensembl's tomato GFF3 names every gene by a bare Solyc id
                showLabels: 'none',
              },
              {
                trackId: 'solanaceae_orthogroups',
                type: 'MultiWaySyntenyDisplay',
                rows: { sort: ['potato', 'pepper', 'tobacco', 'coffee'] },
                height: 320,
              },
            ],
          },
        ],
      },
    ),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 120000,
    viewportHeight: 660,
  },

  {
    mode: 'url',
    name: 'multiway_synteny/drosophila_lanes',
    url: sessionSpec(
      'https://jbrowse.org/demos/orthofinder_drosophila/config.json',
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'melanogaster',
            loc: '3L:5,789,000-5,931,000',
            tracks: [
              {
                trackId: 'melanogaster_genes',
                filter: ['geneLike'],
                displayMode: 'compact',
              },
              {
                trackId: 'drosophila_orthogroups',
                type: 'MultiWaySyntenyDisplay',
                rows: {
                  sort: ['simulans', 'yakuba', 'pseudoobscura', 'virilis'],
                },
                height: 320,
              },
            ],
          },
        ],
      },
    ),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 120000,
    viewportHeight: 660,
  },

  // Strand color is what shows siamang's lane as inverted, since mirroring
  // draws it straight.
  {
    mode: 'url',
    name: 'multiway_synteny/primate_tp53_lanes',
    url: sessionSpec(
      'https://jbrowse.org/demos/primate_orthologs/config.json',
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'hg38',
            loc: 'chr17:7,400,000-7,700,000',
            tracks: [
              {
                trackId: 'primate_orthologs',
                ribbons: { encoding: { color: 'strand' } },
                height: 620,
              },
            ],
          },
        ],
      },
    ),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 180000,
    viewportHeight: 833,
    tooltip: 'hide',
    clicksChange: "close the legend's gene cluster section",
    actions: [
      { type: 'click', selector: '[aria-label="Hide Gene cluster"]' },
      {
        type: 'waitForSelector',
        selector: '[aria-label="Hide Gene cluster"]',
        hidden: true,
      },
    ],
  },

  {
    mode: 'url',
    name: 'multiway_synteny/primate_chr17_inversions',
    url: sessionSpec(
      'https://jbrowse.org/demos/primate_orthologs/config.json',
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'hg38',
            loc: 'chr17:34,000,000-38,000,000',
            tracks: [
              {
                trackId: 'primate_orthologs',
                ribbons: { encoding: { color: 'strand' } },
                height: 620,
              },
            ],
          },
        ],
      },
    ),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 180000,
    viewportHeight: 860,
  },

  // A lane follows one contig, so only a synteny view draws both chimp halves.
  {
    mode: 'url',
    name: 'multiway_synteny/primate_chr2_fusion',
    url: sessionSpec(
      'https://jbrowse.org/demos/primate_orthologs/config.json',
      {
        views: [
          {
            type: 'LinearSyntenyView',
            views: [
              { assembly: 'hg38', loc: 'chr2', hideNoTracksActive: true },
              {
                assembly: 'GCF_028858775.2',
                displayedRegionNames: ['chr12', 'chr13'],
                hideNoTracksActive: true,
              },
            ],
            tracks: [['primate_orthologs']],
            encoding: { color: 'target', opacity: 1 },
            autoDiagonalize: true,
            levelHeights: [300],
          },
        ],
      },
    ),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
    viewportHeight: 600,
    annotations: [
      {
        type: 'text',
        text: 'fusion site',
        leader: true,
        anchor: { view: [0, 0], loc: 'chr2:113,600,000', fracY: 1 },
        dx: 0,
        dy: 110,
      },
    ],
  },

  {
    mode: 'url',
    name: 'multiway_synteny/ecoli_symbol_atp_operon',
    url: sessionSpec('https://jbrowse.org/demos/ecoli_orthologs/config.json', {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'MG1655',
          loc: 'NC_000913.3:3,910,000-3,925,000',
          tracks: [
            {
              trackId: 'ecoli_orthologs',
              height: 1500,
              // strand color here mostly shows deposit orientation and drowns
              // the gene colors
              ribbons: {
                encoding: { color: { value: 'rgba(130,130,130,0.3)' } },
              },
            },
          ],
        },
      ],
    }),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 240000,
    viewportHeight: 1740,
  },

  {
    mode: 'url',
    name: 'multiway_synteny/ecoli_symbol_oantigen',
    url: sessionSpec('https://jbrowse.org/demos/ecoli_orthologs/config.json', {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'MG1655',
          loc: 'NC_000913.3:2,095,000-2,115,000',
          tracks: [
            {
              trackId: 'ecoli_orthologs',
              height: 1500,
              ribbons: {
                encoding: { color: { value: 'rgba(130,130,130,0.3)' } },
              },
            },
          ],
        },
      ],
    }),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 240000,
    viewportHeight: 1740,
  },

  {
    mode: 'url',
    name: 'multiway_synteny/hg38_vertebrates_tp53',
    url: sessionSpec('https://jbrowse.org/demos/hg38_vertebrates/config.json', {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr17:7,400,000-7,700,000',
          tracks: [
            'hg38-ncbiRefSeq',
            {
              trackId: 'hg38_liftover_multiway',
              ribbons: { encoding: { color: 'strand' } },
              rows: { sort: HG38_VERTEBRATES_TREE_ORDER },
              height: 600,
            },
          ],
        },
      ],
    }),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 240000,
    viewportHeight: 1000,
  },

  // built by scripts/build_t2t_apes_cactus_multiway.sh
  // The window stays clear of the segmental duplication near 34.6 Mb, whose
  // copies widen the orangutan lanes' frames.
  {
    mode: 'url',
    name: 'multiway_synteny/t2t_apes_cactus_17q',
    url: sessionSpec(T2T_APES_CACTUS_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr17:39,400,000-40,200,000',
          tracks: [
            'hg38-ncbiRefSeq',
            {
              trackId: 't2t_apes_cactus',
              height: 600,
            },
          ],
        },
      ],
    }),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 240000,
    viewportHeight: 1000,
  },

  // built by scripts/build_amylase_haplotypes.sh
  {
    mode: 'url',
    name: 'multiway_synteny/hprc_amylase_stack',
    url: sessionSpec(AMYLASE_CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          views: [
            {
              assembly: 'HG01361.1',
              loc: 'CM089019.1:103,831,655-104,050,048',
              tracks: ['hprc_genes_HG01361_1'],
            },
            {
              assembly: 'hg38',
              loc: AMYLASE_HG38,
              tracks: ['hg38_ncbiRefSeq_ucsc'],
            },
            {
              assembly: 'HG00133.1',
              loc: 'CM090045.1:103,669,666-103,981,330',
              tracks: ['hprc_genes_HG00133_1'],
            },
            {
              assembly: 'NA18608.2',
              loc: 'CM089849.1:103,796,766-104,203,421',
              tracks: ['hprc_genes_NA18608_2'],
            },
            {
              assembly: 'HG00232.1',
              loc: 'CM089991.1:103,491,008-103,991,760',
              tracks: ['hprc_genes_HG00232_1'],
            },
          ],
          tracks: ['amylase_adjacent'],
          encoding: { color: 'strand' },
          mark: { interpolate: 'bump' },
          levelHeights: [110, 110, 110, 110],
        },
      ],
    }),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 240000,
    viewportHeight: 1400,
  },

  {
    mode: 'url',
    name: 'multiway_synteny/hprc_gstt1_lanes',
    url: portalHaplotypeLanes(PORTAL_LOCI.gstt1),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 240000,
    viewportHeight: 900,
  },

  // built by scripts/build_syri_synteny.sh
  {
    mode: 'url',
    name: 'syri/col_ler_chr4',
    url: sessionSpec(SYRI_CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          views: [
            { assembly: 'Col-0', loc: 'Chr4:1-6,000,000' },
            { assembly: 'Ler', loc: 'Chr4:1-6,000,000' },
          ],
          tracks: [['syri_pangenome']],
          encoding: {
            color: { field: 'syri', scale: { domain: SYRI_TYPES } },
            opacity: 0.9,
          },
          mark: { interpolate: 'bump' },
          render: { antialias: false },
          collapseEmptyRows: true,
          levelHeights: [260],
        },
      ],
    }),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
    viewportHeight: 460,
  },

  {
    mode: 'url',
    name: 'syri/six_accessions',
    url: sessionSpec(SYRI_CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          views: SYRI_ACCESSIONS.map(assembly => ({ assembly })),
          tracks: ['syri_pangenome'],
          encoding: {
            color: { field: 'syri', scale: { domain: SYRI_TYPES } },
            opacity: 0.9,
          },
          mark: { interpolate: 'bump' },
          render: { antialias: false },
          collapseEmptyRows: true,
          levelHeights: SYRI_ACCESSIONS.slice(1).map(() => 150),
        },
      ],
    }),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
    viewportHeight: 1040,
  },

  {
    mode: 'url',
    name: 'syri/col0_lanes',
    url: sessionSpec(SYRI_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'Col-0',
          loc: 'Chr4:1-6,000,000',
          tracks: [
            {
              trackId: 'syri_regions_on_Col-0',
              height: 110,
            },
            {
              trackId: 'syri_pangenome',
              height: 640,
            },
          ],
        },
      ],
    }),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 120000,
    viewportHeight: 1000,
  },

  {
    mode: 'url',
    name: 'syri/tair10_1001g',
    url: sessionSpec(
      'https://jbrowse.org/demos/arabidopsis_pangenome/config.json',
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'TAIR10',
            loc: 'Chr4:1-4,000,000',
            tracks: [
              {
                trackId: 'syri_regions_on_TAIR10',
                height: 644,
              },
            ],
          },
        ],
      },
    ),
    readyText: 'Tnz-1',
    readySelector: '[data-testid="mark-display"] canvas',
    readyTimeout: 120000,
    viewportHeight: 870,
  },

  {
    mode: 'url',
    name: 'multiway_synteny/hg38_vertebrates_17p_strand',
    url: sessionSpec('https://jbrowse.org/demos/hg38_vertebrates/config.json', {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr17:15,200,000-16,400,000',
          tracks: [
            'hg38-ncbiRefSeq',
            {
              trackId: 'hg38_liftover_multiway',
              ribbons: { encoding: { color: 'strand' } },
              rows: { sort: HG38_VERTEBRATES_TREE_ORDER },
              height: 600,
            },
          ],
        },
      ],
    }),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 240000,
    viewportHeight: 1000,
  },

  {
    mode: 'url',
    name: 'multiway_synteny/grasses_rice_lanes',
    url: GRASSES_RICE_LANES,
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 120000,
    viewportHeight: 660,
  },

  // The rhesus window is the human span scaled by 1.06/1.09, the assemblies'
  // local length ratio, on the same centre; otherwise the ribbons shear. The
  // 0.2 default alpha washes out a dozen ribbons.
  {
    mode: 'url',
    name: 'selection_pressure/lysozyme',
    url: sessionSpec(
      'https://jbrowse.org/demos/primate_selection/config.json',
      {
        views: [
          {
            type: 'LinearSyntenyView',
            views: [
              {
                assembly: 'human',
                loc: '12:67,835,000-70,835,000',
                tracks: [
                  {
                    trackId: 'human_genes',
                    showLabels: 'name',
                    displayMode: 'compact',
                  },
                ],
              },
              {
                assembly: 'rhesus',
                loc: '11:67,401,000-70,319,000',
                tracks: [
                  {
                    trackId: 'rhesus_genes',
                    showLabels: 'name',
                    displayMode: 'compact',
                  },
                ],
              },
            ],
            tracks: [['primate_orthologs']],
            encoding: { color: 'dnds', opacity: 0.95 },
            mark: { interpolate: 'bump' },
          },
        ],
      },
    ),
    readyTimeout: 300000,
    viewportHeight: 580,
    // The callout claims no more than the section does: LYZ stands apart, a
    // hypothesis, not a demonstration of selection.
    annotations: [
      {
        type: 'text',
        text: 'LYZ, the only pair above 1. Every neighbour is blue',
        fontSize: 18,
        maxWidth: 300,
        // right of LYZ; centred, the pill covers the ribbon it names
        anchor: {
          view: [0, 0],
          trackId: 'human_genes',
          loc: '12:69,351,000',
          fracY: 1,
          dy: 45,
          alignX: 'right',
          dx: 95,
        },
      },
      {
        type: 'arrow',
        fromAnchor: {
          view: [0, 0],
          trackId: 'human_genes',
          loc: '12:69,351,000',
          fracY: 1,
          dy: 52,
          alignX: 'right',
          dx: 88,
        },
        anchor: {
          view: [0, 0],
          trackId: 'human_genes',
          loc: '12:69,351,000',
          fracY: 1,
          dy: 52,
          dx: 8,
        },
      },
    ],
  },

  // The dS domain is pinned at about every pair type's 90th percentile, so a
  // cell's color is a dS and not a rank among the values in view.
  {
    mode: 'url',
    name: 'homoeolog_synteny/oat_ds',
    url: sessionSpec('https://jbrowse.org/demos/oat_homoeologs/config.json', {
      views: [
        {
          type: 'DotplotView',
          displayName: 'Oat self-alignment, dS',
          views: [
            { assembly: 'oat', displayedRegionNames: OAT_HOMOEOLOG_GROUPS },
            { assembly: 'oat', displayedRegionNames: OAT_HOMOEOLOG_GROUPS },
          ],
          tracks: ['oat_homoeologs'],
          encoding: {
            color: {
              field: 'ds',
              scale: { domainMin: 0, domainMax: 0.25 },
              legend: { title: 'dS' },
            },
          },
        },
      ],
    }),
    readySelector: displayPainted('dotplot_webgl_canvas'),
    readyTimeout: 300000,
    viewportHeight: 767,
    viewportWidth: 900,
  },

  {
    mode: 'url',
    name: 'orthofinder_synteny/vertebrates',
    url: sessionSpec(
      'https://jbrowse.org/demos/orthofinder_vertebrates/config.json',
      {
        views: [
          {
            type: 'LinearSyntenyView',
            views: [
              { assembly: 'human' },
              { assembly: 'chicken' },
              { assembly: 'frog' },
              { assembly: 'gar' },
              { assembly: 'zebrafish' },
            ],
            tracks: ['vertebrates_orthogroups'],
            encoding: { color: 'reference', opacity: 0.3 },
            // The gar-zebrafish band stays scrambled whatever the ordering:
            // past the teleost duplication a gar chromosome maps to two.
            autoDiagonalize: true,
            coord: { ratio: 1 },
            collapseEmptyRows: true,
            levelHeights: [180, 180, 180, 180],
            // Alpha follows collinearity: these scattered links vanish at the
            // grasses' 0.15.
            mark: { interpolate: 'linear' },
          },
        ],
      },
    ),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
    viewportHeight: 1000,
    // pushed into the left of the gar band, where no ribbons run
    annotations: [
      {
        type: 'text',
        text: 'teleost duplication:\neach gar chromosome lands on two in zebrafish',
        fontSize: 20,
        maxWidth: 380,
        anchor: { text: 'gar', alignX: 'left' },
        dx: 10,
        dy: 60,
      },
    ],
  },

  {
    mode: 'url',
    name: 'orthofinder_synteny/solanaceae',
    url: sessionSpec(
      'https://jbrowse.org/demos/orthofinder_solanaceae/config.json',
      {
        views: [
          {
            type: 'LinearSyntenyView',
            views: [
              { assembly: 'tomato' },
              { assembly: 'potato' },
              { assembly: 'pepper' },
              { assembly: 'tobacco' },
              { assembly: 'coffee' },
            ],
            tracks: ['solanaceae_orthogroups'],
            encoding: { color: 'reference', opacity: 0.2 },
            autoDiagonalize: true,
            coord: { ratio: 1 },
            collapseEmptyRows: true,
            levelHeights: [180, 180, 180, 180],
            mark: { interpolate: 'linear' },
          },
        ],
      },
    ),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
    viewportHeight: 1000,
  },

  // melanogaster repeats between the others so every band touches it and
  // 'reference' resolves to it; in a plain chain it resolves to simulans.
  {
    mode: 'url',
    name: 'orthofinder_synteny/drosophila',
    url: sessionSpec(
      'https://jbrowse.org/demos/orthofinder_drosophila/config.json',
      {
        views: [
          {
            type: 'LinearSyntenyView',
            views: [
              { assembly: 'simulans' },
              { assembly: 'melanogaster' },
              { assembly: 'yakuba' },
              { assembly: 'melanogaster' },
              { assembly: 'pseudoobscura' },
              { assembly: 'melanogaster' },
              { assembly: 'virilis' },
            ],
            tracks: ['drosophila_orthogroups'],
            encoding: { color: 'reference', opacity: 0.15 },
            autoDiagonalize: true,
            diagonalizeAnchorRow: 1,
            coord: { ratio: 1 },
            collapseEmptyRows: true,
            levelHeights: [150, 150, 150, 150, 150, 150],
            mark: { interpolate: 'linear' },
          },
        ],
      },
    ),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
    viewportHeight: 1240,
  },

  {
    mode: 'url',
    name: 'orthofinder_synteny/drosophila_blocks',
    url: sessionSpec(
      'https://jbrowse.org/demos/orthofinder_drosophila/config.json',
      {
        views: [
          {
            type: 'LinearSyntenyView',
            views: [
              { assembly: 'simulans' },
              { assembly: 'melanogaster' },
              { assembly: 'yakuba' },
              { assembly: 'melanogaster' },
              { assembly: 'pseudoobscura' },
              { assembly: 'melanogaster' },
              { assembly: 'virilis' },
            ],
            tracks: ['drosophila_blocks'],
            encoding: { color: 'reference', opacity: 0.5 },
            autoDiagonalize: true,
            diagonalizeAnchorRow: 1,
            coord: { ratio: 1 },
            collapseEmptyRows: true,
            levelHeights: [150, 150, 150, 150, 150, 150],
            mark: { interpolate: 'linear' },
          },
        ],
      },
    ),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
    viewportHeight: 1240,
  },

  {
    mode: 'url',
    name: 'orthofinder_synteny/grasses',
    url: sessionSpec(
      'https://jbrowse.org/demos/orthofinder_grasses/config.json',
      {
        views: [
          {
            type: 'LinearSyntenyView',
            views: [
              { assembly: 'rice' },
              { assembly: 'sorghum' },
              { assembly: 'maize' },
              { assembly: 'brachypodium' },
              { assembly: 'setaria' },
            ],
            tracks: ['grasses_orthogroups'],
            encoding: { color: 'reference', opacity: 0.15 },
            autoDiagonalize: true,
            coord: { ratio: 1 },
            collapseEmptyRows: true,
            levelHeights: [180, 180, 180, 180],
            // at the 0.2 default the hairline links saturate into one wash
            // curved bundles braid mid-band and stop pointing at a partner
            mark: { interpolate: 'linear' },
          },
        ],
      },
    ),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
    viewportHeight: 1000,
  },

  // Re-derive the window's counts with
  //   python3 scripts/orthofinder_window_stats.py grasses \
  //     --row 'sorghum 1:5,934,000-6,126,000[rev]' \
  //     --row 'rice 3:31,590,000-31,775,000' \
  //     --row 'maize 1:286,676,000-287,665,000 5:6,261,000-6,790,000[rev]' \
  //     --query rice
  // Each row frames its own copy of the block. coord.ratio squeezes rice and
  // sorghum to a sliver, and a wider rice window fills the top band with genes
  // the maize windows miss, so the two bands stop counting the same genes.
  {
    mode: 'url',
    name: 'orthofinder_synteny/grasses_maize_wgd',
    viewportHeight: 1200,
    url: sessionSpec(
      'https://jbrowse.org/demos/orthofinder_grasses/config.json',
      {
        views: [
          {
            type: 'LinearSyntenyView',
            views: [
              {
                // Sorghum and maize 5 run backwards against rice; unflipped,
                // each draws as an hourglass.
                assembly: 'sorghum',
                loc: '1:5,934,000-6,126,000[rev]',
                tracks: [
                  {
                    trackId: 'sorghum_genes',
                    filter: ['geneLike'],
                    displayMode: 'compact',
                    showLabels: 'none',
                    height: 40,
                  },
                ],
              },
              {
                assembly: 'rice',
                loc: '3:31,590,000-31,775,000',
                tracks: [
                  {
                    trackId: 'rice_genes',
                    filter: ['geneLike'],
                    displayMode: 'compact',
                    showLabels: 'none',
                    height: 40,
                  },
                ],
              },
              {
                assembly: 'maize',
                loc: '1:286,676,000-287,665,000 5:6,261,000-6,790,000[rev]',
                tracks: [
                  {
                    trackId: 'maize_genes',
                    filter: ['geneLike'],
                    displayMode: 'compact',
                    showLabels: 'none',
                    height: 40,
                  },
                ],
              },
            ],
            tracks: ['grasses_orthogroups'],
            // 'target' colors the bottom band by maize chromosome; 'reference'
            // paints one color when each row holds one or two chromosomes
            encoding: { color: 'target', opacity: 0.65 },
            // curves knot where the two fans meet on maize 5's side
            mark: { interpolate: 'linear' },
            // at 1 a crossing shows only the last ribbon; at 0.35 the top band
            // washes out
            // the bottom band's crossings are unavoidable and need the room
            levelHeights: [190, 500],
          },
        ],
      },
    ),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
  },

  // The row order follows the evolutionary chain, so each band is a real step.
  {
    mode: 'url',
    name: 'orthofinder_synteny/wheat',
    url: sessionSpec(
      'https://jbrowse.org/demos/orthofinder_wheat/config.json',
      {
        views: [
          {
            type: 'LinearSyntenyView',
            views: [
              { assembly: 'tauschii' },
              { assembly: 'wheat' },
              { assembly: 'durum' },
              { assembly: 'emmer' },
              { assembly: 'urartu' },
              { assembly: 'timopheevii' },
            ],
            tracks: ['wheat_orthogroups'],
            encoding: { color: 'reference', opacity: 0.15 },
            autoDiagonalize: true,
            // fit-to-width stretches tauschii's 7 chromosomes over wheat's 21
            // and fans a clean 1:1 D-genome map
            coord: { ratio: 1 },
            collapseEmptyRows: true,
            levelHeights: [170, 170, 170, 170, 170],
            mark: { interpolate: 'linear' },
          },
        ],
      },
    ),
    readySelector: displayPainted('synteny_canvas'),
    // 120s times out on a GPU-less CI runner
    readyTimeout: 300000,
    // any shorter cuts the bottom row's scalebar in half
    viewportHeight: 1140,
    // A pill dropped below its row lands in the band, which names a pair of
    // genomes; on the row's own line it names one.
    annotations: [
      {
        type: 'text',
        text: 'D genome donor',
        fontSize: 20,
        anchor: { text: 'tauschii', alignX: 'left' },
        dx: 90,
      },
      { type: 'box', anchor: { text: 'tauschii' } },
      {
        type: 'text',
        text: 'A genome donor',
        fontSize: 20,
        anchor: { text: 'urartu', alignX: 'left' },
        dx: 90,
      },
      { type: 'box', anchor: { text: 'urartu' } },
    ],
  },

  // Re-derive the counts with
  //   python3 scripts/orthofinder_window_stats.py wheat \
  //     --row 'tauschii 1D 2D 3D 4D 5D 6D 7D' --row 'wheat 4A' --query wheat
  // The bottom row is a bare scalebar, so a locus anchor or `highlight` on it
  // has nowhere to land; the pills anchor on the top row's labels instead.
  {
    mode: 'url',
    name: 'orthofinder_synteny/wheat_4a',
    url: sessionSpec(
      'https://jbrowse.org/demos/orthofinder_wheat/config.json',
      {
        views: [
          {
            type: 'LinearSyntenyView',
            views: [
              // the whole D genome: that only three of seven chromosomes reach
              // 4A is the content
              { assembly: 'tauschii' },
              { assembly: 'wheat', loc: '4A' },
            ],
            tracks: [['wheat_orthogroups']],
            // 'reference' paints the whole figure one color: every link lands
            // on 4A
            encoding: { color: 'query', opacity: 0.5 },
            // the order along 4A is the finding; diagonalizing rewrites it
            autoDiagonalize: false,
            // no coord.ratio: a shared bp/px draws 4A a sixth of the frame wide
            collapseEmptyRows: true,
            levelHeights: [430],
            // at 0.15 the two translocated bundles read as smoke
            mark: { interpolate: 'linear' },
          },
        ],
      },
    ),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
    viewportHeight: 640,
    // by testid: a bare `text: '5D'` matches a tick label under 1D first
    annotations: [
      {
        type: 'text',
        text: '4AL/5AL',
        fontSize: 20,
        anchor: { selector: '[data-testid="refLabel-5D"]', alignX: 'left' },
        dy: 54,
      },
      {
        type: 'text',
        text: '4AL/7BS',
        fontSize: 20,
        anchor: { selector: '[data-testid="refLabel-7D"]', alignX: 'right' },
        dx: -30,
        dy: 150,
      },
    ],
  },

  {
    mode: 'url',
    name: 'multiway_synteny/ecoli_pangenome',
    url: sessionSpec('https://jbrowse.org/demos/ecoli_pangenome/config.json', {
      views: [ecoliAvaStack('ecoli_ava')],
    }),
    viewportHeight: ECOLI_AVA_STACK_HEIGHT,
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
  },

  // Both windows span the same 100 kb, so the rows share a bp/px, and start
  // at the shared backbone block (Sakai 1,210,882 <-> K12 1,031,619) so its
  // ribbon runs level. The island's far flanks align to K12 ~566 kb instead.
  {
    mode: 'url',
    name: 'multiway_synteny/ecoli_stx_island',
    url: sessionSpec('https://jbrowse.org/demos/ecoli_pangenome/config.json', {
      views: [
        {
          type: 'LinearSyntenyView',
          views: [
            {
              assembly: 'K12',
              loc: 'chr:1,026,000-1,126,000',
              tracks: [
                {
                  trackId: 'K12_genes',
                  filter: ['geneLike'],
                  displayMode: 'compact',
                  showLabels: 'auto',
                },
              ],
            },
            {
              assembly: 'Sakai',
              loc: 'chr:1,205,000-1,305,000',
              tracks: [
                {
                  trackId: 'Sakai_genes',
                  filter: ['geneLike'],
                  displayMode: 'compact',
                  showLabels: 'auto',
                },
              ],
            },
          ],
          tracks: [['ecoli_ava']],
          mark: { interpolate: 'bump' },
        },
      ],
    }),
    viewportHeight: 560,
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
    annotations: [
      {
        // x is the frame's right edge, so the pill and the arrow tail stay raw
        type: 'text',
        text: 'stx2 (Shiga toxin) prophage island\npresent in Sakai, absent from K-12',
        x: 1470,
        y: 335,
        textAlign: 'end',
        maxWidth: 380,
      },
      {
        type: 'arrow',
        from: { x: 1085, y: 365 },
        // stops short of the label, which the box marks
        anchor: { text: 'stx2B' },
        dx: 45,
        dy: -28,
      },
      {
        // a label-sized box clips the glyph above the label
        type: 'box',
        anchor: { text: 'stx2B' },
        dy: -14,
        height: 36,
      },
    ],
  },

  // The window holds shared flank on both sides of the paa island, so lanes
  // visibly stop and restart.
  {
    mode: 'url',
    name: 'multiway_synteny/ecoli_one_vs_all',
    url: sessionSpec('https://jbrowse.org/demos/ecoli_pangenome/config.json', {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:1,440,000-1,473,000',
          // Any heavier alpha tints the bars, and darker salmon already means
          // overlap depth.
          highlight: [
            {
              refName: 'chr',
              start: 1446100,
              end: 1467921,
              color: 'rgba(214,137,16,0.13)',
            },
          ],
          tracks: [
            {
              trackId: 'K12_genes',
              filter: ['geneLike'],
              displayMode: 'compact',
              showLabels: 'auto',
            },
            // the graph pane's ramp, so a node and its span share a hue
            {
              trackId: 'ecoli_minigraph_segments',
              type: 'LinearBasicDisplay',
              encoding: {
                color: { value: referencePositionColor(PAA_COLOR_DOMAIN) },
              },
              height: 70,
            },
            {
              trackId: 'ecoli_ava',
              // `minimap2 -X` built the PAF, so the K12 lane holds only paralogy
              facet: { field: 'mateAssembly', hidden: ['K12'] },
              pileup: {
                mark: { height: 14 },
              },
              height: 135,
            },
          ],
        },
        // A gfatools slice: the tabix-indexed segments cut drops the CFT073
        // and IAI39 detours to stubs. Same file as pangenome/rgfa_paa_bubble.
        {
          type: 'GraphGenomeView',
          gfaLocation: { uri: `${ECOLI_DEMO_BASE}/ecoli_paa_subgraph.gfa` },
          layoutMode: 'force',
          color: {
            field: 'position',
            domainMin: PAA_COLOR_DOMAIN.start,
            domainMax: PAA_COLOR_DOMAIN.end,
          },
        },
      ],
    }),
    viewportHeight: 1290,
    // `body:has(A) B` waits for both; a selector list fires on either
    readySelector: `body:has(${GRAPH_VIEW_DRAWN}) ${displayPainted('pileup-display')}`,
    readyTimeout: 120000,
    annotations: [
      {
        type: 'text',
        fontSize: 18,
        maxWidth: 560,
        anchor: {
          trackId: 'ecoli_ava',
          loc: 'chr:1,444,500',
          alignY: 'bottom',
          dy: -40,
        },
        text: 'paa operon (phenylacetate catabolism): present in K-12 and NCTC86, absent from the other three',
      },
      {
        // the node pangenome/rgfa_paa_bubble rings
        type: 'circle',
        anchor: { view: 1, graphNode: 's502' },
        radius: 40,
      },
    ],
  },

  // Separate specs, not `stages`, so each frame takes only its own height. The
  // paa window would launch a pairwise view: three strains do not align there.
  ...launchFromSelectionParts(),
  {
    mode: 'compose',
    name: 'multiway_synteny/ecoli_launch_from_selection',
    parts: [
      'multiway_synteny/ecoli_launch_selection',
      'multiway_synteny/ecoli_launch_result',
    ],
  },
  // Not ecoli_pggb_ava: its NCTC86 is the reverse-complemented 4,903,501 bp
  // deposit, which draws as a whole-genome inversion, and it holds every pair
  // in both directions, doubling the overlap shading.
  {
    mode: 'url',
    name: 'multiway_synteny/ecoli_one_vs_all_whole_genome',
    url: ecoliOneVsAllUrl(120),
    viewportHeight: 890,
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
  },

  // ECOLI_IDENTITY_TRACK matches the page's own config fence
  {
    mode: 'url',
    name: 'multiway_synteny/ecoli_identity_rows',
    url: sessionSpec('https://jbrowse.org/demos/ecoli_pangenome/config.json', {
      sessionTracks: [ECOLI_IDENTITY_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:1-4,641,652',
          tracks: [
            {
              trackId: 'ecoli_ava_identity',
              height: 400,
            },
          ],
        },
      ],
    }),
    viewportHeight: 620,
    readySelector: displayPainted('mark-display'),
    readyTimeout: 120000,
  },

  // A session spec cannot open the import form: sessionSpec rejects a
  // LinearSyntenyView with fewer than two views.
  {
    mode: 'url',
    name: 'multiway_synteny/ecoli_import_form',
    url: sessionSpec('https://jbrowse.org/demos/ecoli_pangenome/config.json', {
      views: [],
    }),
    readyText: 'Select a view to launch',
    readyTimeout: 60000,
    viewportHeight: 356,
    clicksChange: "open a Linear synteny view's import form from the Add menu",
    actions: [
      { type: 'click', text: 'Add' },
      { type: 'waitForText', text: 'Linear synteny view' },
      { type: 'click', text: 'Linear synteny view' },
      // the rows summary renders once a track is selected
      {
        type: 'waitForSelector',
        selector: '[data-testid="quick-start-rows"]',
      },
      { type: 'delay', ms: 1000 },
    ],
    // Pills and arrow tails stay raw together in the form's empty right half;
    // anchoring a tail alone pulls the arrow off its pill.
    annotations: [
      {
        type: 'text',
        text: 'Quick start launches straight from a synteny track',
        x: 780,
        y: 95,
        maxWidth: 320,
      },
      {
        type: 'arrow',
        from: { x: 770, y: 110 },
        anchor: { text: 'Quick start' },
      },
      {
        type: 'box',
        anchor: { selector: '[data-testid="quick-start-rows"]' },
      },
      {
        type: 'text',
        text: 'Every assembly in the track becomes a row',
        x: 780,
        y: 205,
        maxWidth: 340,
      },
      {
        type: 'arrow',
        from: { x: 770, y: 220 },
        anchor: { selector: '[data-testid="quick-start-rows"]' },
      },
    ],
  },

  {
    mode: 'url',
    name: 'mcscan_anchors',
    url: sessionSpec(GRAPE_PEACH_CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          mark: { interpolate: 'bump' },
          tracks: [['grape_peach_anchors', 'grape_peach_anchors_simple']],
          levelHeights: [236],
          views: [
            {
              assembly: PEACH,
              loc: 'chrG5:4,700,000-13,000,000',
              tracks: [
                {
                  trackId: 'grape_peach_anchors_simple',
                  height: 60,
                },
              ],
            },
            {
              assembly: GRAPE,
              loc: 'chr2:1-8,200,000',
              tracks: [
                {
                  trackId: 'grape_peach_anchors_simple',
                  height: 60,
                },
              ],
            },
          ],
        },
      ],
    }),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 60000,
    viewportHeight: 640,
  },

  ...mcscanFilePartSpecs(),
  {
    mode: 'compose',
    name: 'mcscan_synteny/anchors_vs_simple',
    parts: ['mcscan_synteny/anchors', 'mcscan_synteny/anchors_simple'],
  },

  {
    mode: 'url',
    name: 'mcscan_synteny/dotplot',
    url: sessionSpec(GRAPE_PEACH_CONFIG, {
      views: [
        {
          type: 'DotplotView',
          views: [{ assembly: PEACH }, { assembly: GRAPE }],
          tracks: ['grape_peach_anchors'],
          autoDiagonalize: true,
        },
      ],
    }),
    readySelector: displayPainted('dotplot_webgl_canvas'),
    readyTimeout: 60000,
  },

  // A collinear forward run of 21 pairs, about 140 kb on each side, so the
  // ribbons run parallel, and unpaired genes sit beside the paired ones.
  {
    mode: 'url',
    name: 'mcscan_synteny/gene_level',
    url: sessionSpec(GRAPE_PEACH_CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          views: [
            {
              assembly: GRAPE,
              loc: 'chr13:1,190,000-1,345,000',
              tracks: [
                {
                  trackId: `${GRAPE}-ncbiRefSeq`,
                  filter: ['geneLike'],
                  displayMode: 'compact',
                  showLabels: 'auto',
                  height: 70,
                },
              ],
            },
            {
              assembly: PEACH,
              loc: 'chrG2:26,925,000-27,075,000',
              tracks: [
                {
                  trackId: `${PEACH}-ncbiRefSeq`,
                  filter: ['geneLike'],
                  displayMode: 'compact',
                  showLabels: 'auto',
                  height: 70,
                },
              ],
            },
          ],
          tracks: [['grape_peach_anchors']],
          mark: { interpolate: 'linear' },
          levelHeights: [220],
        },
      ],
    }),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 60000,
    // any shorter clips the peach gene lane
    viewportHeight: 616,
  },

  // One-to-one pairs beside depth-2 and depth-3 ones in one window, so the
  // grey and both oranges are all in frame.
  {
    mode: 'url',
    name: 'mcscan_synteny/syntenic_depth',
    url: sessionSpec(GRAPE_PEACH_CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          views: [
            {
              assembly: GRAPE,
              loc: 'chr3:2,825,000-2,970,000',
              tracks: [
                {
                  trackId: `${GRAPE}-ncbiRefSeq`,
                  filter: ['geneLike'],
                  displayMode: 'compact',
                  showLabels: 'auto',
                  height: 70,
                },
              ],
            },
            {
              assembly: PEACH,
              loc: 'chrG8:18,055,000-18,225,000',
              tracks: [
                {
                  trackId: `${PEACH}-ncbiRefSeq`,
                  filter: ['geneLike'],
                  displayMode: 'compact',
                  showLabels: 'auto',
                  height: 70,
                },
              ],
            },
          ],
          tracks: [['grape_peach_anchors']],
          mark: { interpolate: 'linear' },
          levelHeights: [220],
          encoding: { color: 'syntenicDepth' },
        },
      ],
    }),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 60000,
    viewportHeight: 616,
  },

  // mirrors the hs1_vs_mm39 config's defaultSession
  {
    mode: 'url',
    name: 'hs1_vs_mm39_synteny',
    url: sessionSpec(HS1_MM39_CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['hs1ToMm39.over.chain.pif'],
          filter: [{ field: 'length', gte: 500000 }],
          mark: { interpolate: 'linear' },
          autoDiagonalize: true,
          encoding: { color: 'query', opacity: 0.4 },
          levelHeights: [350],
          views: [{ assembly: 'hs1' }, { assembly: 'mm39' }],
        },
      ],
    }),
    viewportHeight: 672,
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 180000,
  },

  // 'matches' keeps strand the only thing the ribbon color means
  {
    ...TNNT3_FRAME,
    name: 'synteny_hg38_hs1_tnnt3',
    url: tnnt3Session(
      { mark: { interpolate: 'bump' }, indels: { encoding: { opacity: 0 } } },
      { markLinc01150: true },
    ),
  },

  {
    ...TNNT3_FRAME,
    name: 'genomes_synteny/ribbons_default',
    url: tnnt3Session(),
    actions: [
      { type: 'click', selector: '[aria-label="Synteny display settings"]' },
      { type: 'waitForText', text: 'CIGAR indels' },
      // swiftshader rasterizes the menu's layer a frame or two late
      { type: 'delay', ms: 1000 },
    ],
    annotations: [
      {
        type: 'text',
        x: 24,
        y: 56,
        fontSize: 22,
        text: 'Straight ribbons, colored indels',
      },
      { type: 'box', anchor: { text: 'CIGAR indels' } },
      { type: 'box', anchor: { text: 'Curved lines' } },
    ],
  },
  {
    ...TNNT3_FRAME,
    name: 'genomes_synteny/ribbons_curved',
    url: tnnt3Session({
      mark: { interpolate: 'bump' },
      indels: { encoding: { opacity: 0 } },
    }),
    annotations: [
      {
        type: 'text',
        x: 24,
        y: 56,
        fontSize: 22,
        text: 'Curved lines + transparent indels',
      },
    ],
  },
  {
    mode: 'compose',
    name: 'genomes_synteny/ribbon_settings',
    parts: [
      'genomes_synteny/ribbons_default',
      'genomes_synteny/ribbons_curved',
    ],
  },

  // The launch menu item needs the mate assembly to resolve; the Hubs plugin
  // in this config resolves panTro6 on demand. The window holds a 6 kb L1HS
  // in an FTO intron with clean flanks; the RB1/PICALM loci would republish
  // the linear-synteny guide's figures. The gene track's fixed height keeps
  // the right-click's depth below it stable.
  {
    mode: 'url',
    name: 'genomes_synteny/launch_sequence',
    url: sessionSpec(UCSC_HG38_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr16:54,036,000-54,054,000',
          tracks: [
            {
              trackId: 'hg38-ncbiRefSeqCurated',
              geneGlyphMode: 'longestCoding',
              height: 60,
            },
            // open before the launch, so the launch copies it into the human panel
            {
              trackId: 'hg38-rmsk',
              displayMode: 'compact',
              height: 70,
            },
            {
              // collapsed, a right-click lands on whatever merged fragment is
              // under the cursor
              trackId: 'hg38_to_panTro6_liftOver',
              collapseSections: false,
              height: 60,
            },
          ],
        },
      ],
    }),
    viewportWidth: 900,
    viewportHeight: 575,
    columns: 2,
    tooltip: 'hide',
    // the hub plugin's "Successfully loaded" snackbar
    hideSelectors: ['.MuiSnackbar-root'],
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 120000,
    stages: [
      {
        // at 575 the Launch submenu lands over its own parent row
        viewportHeight: 700,
        actions: [
          // The block row is the display's top ~7px. Left of centre, so the
          // submenu opens rightward without flipping over its parent.
          {
            type: 'rightclick',
            anchor: {
              trackId: 'hg38_to_panTro6_liftOver',
              loc: 'chr16:54,038,800',
              fracY: 0,
              dy: 4,
            },
          },
          { type: 'waitForText', text: 'Open feature details' },
          ...menuCascade(['Launch', 'Linear synteny view with panTro6']),
          { type: 'hover', text: 'Linear synteny view with panTro6' },
          { type: 'delay', ms: 500 },
        ],
        annotations: [
          // all four step labels share fontSize 30
          {
            type: 'text',
            x: 24,
            y: 56,
            fontSize: 30,
            text: '(1) Right-click a chain block',
          },
          {
            type: 'box',
            anchor: { text: 'Launch' },
            strokeWidth: 3,
          },
          {
            type: 'box',
            anchor: { text: 'Linear synteny view with panTro6' },
            strokeWidth: 3,
          },
        ],
      },
      {
        actions: [
          { type: 'click', text: 'Linear synteny view with panTro6' },
          // the dialog's own text, not its title, which names the launch too
          {
            type: 'waitForText',
            text: 'Use CIGAR to map the current visible region to the target',
          },
        ],
        annotations: [
          {
            type: 'text',
            x: 24,
            y: 56,
            fontSize: 30,
            text: '(2) Confirm how each panel is framed',
          },
        ],
      },
      {
        actions: [
          { type: 'click', text: 'Replace current view' },
          {
            type: 'waitForSelector',
            selector: displayPainted('synteny_canvas'),
            timeout: 120000,
          },
        ],
        viewportHeight: 570,
        annotations: [
          {
            type: 'text',
            x: 24,
            y: 56,
            fontSize: 30,
            text: '(3) The synteny view it opens',
          },
        ],
      },
      // Its own session, with the locs stage 3's CIGAR mapping produced. The
      // hub plugin brings the panTro6 tracks along with the assembly.
      {
        url: sessionSpec(UCSC_HG38_CONFIG, {
          views: [
            {
              type: 'LinearSyntenyView',
              tracks: [['hg38_to_panTro6_liftOver']],
              mark: { interpolate: 'bump' },
              indels: { encoding: { opacity: 0 } },
              views: [
                {
                  assembly: 'hg38',
                  loc: 'chr16:54,035,008-54,055,008',
                  tracks: FTO_PANEL_TRACKS.hg38,
                },
                {
                  assembly: 'panTro6',
                  loc: 'chr16:39,085,191-39,099,009',
                  tracks: FTO_PANEL_TRACKS.panTro6,
                },
              ],
            },
          ],
        }),
        readySelector: displayPainted('synteny_canvas'),
        // any shorter clips the chimp RepeatMasker row
        viewportHeight: 704,
        annotations: [
          {
            type: 'text',
            x: 24,
            y: 56,
            fontSize: 30,
            text: '(4) Chimp tracks on, transparent indels',
          },
        ],
      },
    ],
  },

  // Staging only: production gates the link off (`features.multiwayStar` in
  // jb2hubs). The table re-sorts while "Working out which species" shows.
  {
    mode: 'url',
    name: 'genomes_synteny/star_link',
    noSession: true,
    url: TNNT3_GENE_ORDER_PAGE,
    readySelector: STAR_LINK,
    readyTimeout: 90000,
    viewportWidth: 1100,
    viewportHeight: 760,
    liveLabel: 'Open the TNNT3 conserved gene order page',
    diffThreshold: 0.02,
    actions: [
      {
        type: 'waitForText',
        text: 'Working out which species',
        hidden: true,
        timeout: 90000,
      },
      { type: 'hover', selector: STAR_LINK },
      { type: 'delay', ms: 500 },
    ],
    annotations: [
      {
        type: 'box',
        anchor: { selector: STAR_LINK },
        strokeWidth: 3,
      },
    ],
  },

  {
    mode: 'url',
    name: 'genomes_synteny/star_lanes',
    url: tnnt3StarSession(),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 240000,
    viewportWidth: 1300,
    viewportHeight: 770,
  },

  {
    mode: 'url',
    name: 'genomes_synteny/mouse_strains_nnt',
    url: hostedStarSession(
      'mm39',
      'chr13:119,460,000-119,560,000',
      [
        'GCA_964188535.1',
        'GCA_921999865.2',
        'GCA_921998555.2',
        'GCA_001624215.1',
        'GCA_921997145.2',
        'GCA_921997125.2',
        'GCA_001624505.1',
        'GCA_921998325.2',
        'GCA_001624745.1',
        'GCA_001624835.1',
        'GCA_001624775.1',
        'GCA_921999005.2',
        'GCA_921997135.2',
        'GCF_900094665.2',
      ],
      // one gene in the window, so the gene track gives its height to the lanes
      { height: 15 * 52 },
      { height: 70 },
    ),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 240000,
    viewportWidth: 1300,
    viewportHeight: 1102,
    liveLabel: 'Open the mouse strains at Nnt',
  },

  {
    mode: 'url',
    name: 'genomes_synteny/human_17q21_haplotypes',
    // H9 hap2, the H2 inversion carrier, sits next to hg38, then hap1
    url: hostedStarSession(
      'hg38',
      'chr17:45,300,000-46,800,000',
      [
        'GCA_054883265.1',
        'GCA_054883195.1',
        'GCA_018852615.2',
        'GCA_018506965.1',
        'hs1',
      ],
      {
        ribbons: { encoding: { color: 'strand' } },
        showGeneLabels: false,
        height: 6 * 60,
      },
    ),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 240000,
    viewportWidth: 1300,
    viewportHeight: 725,
    liveLabel: 'Open the five haplotypes at 17q21.31',
  },

  // One dotplot per haplotype: both on one y axis double every diagonal.
  {
    mode: 'url',
    name: 'sv_cgiab/dotplot_haplotypes',
    url: sessionSpec(CGIAB_CONFIG, {
      views: (['hap1', 'hap2'] as const).map(hap => ({
        type: 'DotplotView',
        displayName: `HG008-T v3.2 ${hap} vs GRCh38`,
        views: [
          { assembly: 'GRCh38_GIABv3' },
          { assembly: 'HG008T_v3.2', displayedRegionNames: [`*_${hap}`] },
        ],
        tracks: ['HG008T_v3.2_pif'],
        autoDiagonalize: true,
        height: 640,
      })),
      layout: {
        direction: 'horizontal',
        children: [
          { views: [0], size: 50 },
          { views: [1], size: 50 },
        ],
      },
    }),
    readySelector: displayPainted('dotplot_webgl_canvas'),
    readyTimeout: 90000,
    viewportWidth: 1800,
    viewportHeight: 820,
    annotations: [
      {
        type: 'text',
        text: 'chr3/chr13 fusion',
        leader: true,
        anchor: { view: 0, hLoc: 'chr13', vLoc: 'chr3_chr13_hap1' },
        dx: 40,
        dy: 80,
      },
      {
        type: 'text',
        text: 'chr13 intact',
        leader: true,
        anchor: { view: 1, hLoc: 'chr13', vLoc: 'chr13_hap2' },
        dx: 40,
        dy: 80,
      },
    ],
  },

  junctionScaffold('sv_cgiab/junction_synteny'),
  scaffoldOverview('sv_cgiab/synteny_view'),

  {
    mode: 'url',
    // setting assemblies auto-launches the view past the import form
    name: 'sv_synteny/dotplot_import',
    viewportHeight: 561,
    url: sessionSpec(HPYLORI_CONFIG, {
      views: [{ type: 'DotplotView', views: [{}, {}] }],
    }),
    readyText: 'Quick start',
    readyTimeout: 60000,
    clicksChange: 'switch the import form to Manual',
    actions: [
      { type: 'click', text: 'Manual' },
      { type: 'waitForText', text: 'Select assemblies for dotplot view' },
      { type: 'delay', ms: 1000 },
    ],
  },

  {
    mode: 'url',
    name: 'sv_synteny/dotplot',
    url: sessionSpec(HPYLORI_CONFIG, {
      views: [
        {
          type: 'DotplotView',
          tracks: ['26695_vs_j99.pif'],
          // the axis order Quick start produces, so the tutorial's clicks land
          // on this plot
          views: [
            { assembly: 'GCF_000307795.1' },
            { assembly: 'GCF_000982695.1' },
          ],
        },
      ],
    }),
  },

  {
    mode: 'url',
    name: 'sv_synteny/linear_synteny_genes',
    viewportHeight: 822,
    url: hpyloriSyntenyWithGenes(),
    readyText: 'NC_018939v1',
    readyTimeout: 60000,
  },

  {
    mode: 'url',
    name: 'sv_synteny/ortholog_colors',
    url: hpyloriSyntenyWithGenes({ geneColor: { field: 'gene' } }),
    readyText: 'NC_018939v1',
    readyTimeout: 60000,
    // the default 800 clips the bottom strain's gene labels
    viewportHeight: 842,
    // half of a side-by-side pair; see color_by_attribute_steps
    viewportWidth: 900,
  },

  // The Autocomplete field takes typing by testid only: its label resolves to
  // an element that takes no focus. Escape folds the suggestion list.
  {
    mode: 'url',
    name: 'sv_synteny/color_by_attribute',
    url: hpyloriSyntenyWithGenes(),
    readyText: 'NC_018939v1',
    readyTimeout: 60000,
    viewportHeight: 842,
    viewportWidth: 900,
    tooltip: 'hide',
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      { type: 'waitForText', text: 'Color by' },
      { type: 'hover', text: 'Color by' },
      { type: 'waitForText', text: 'Attribute...' },
      { type: 'click', text: 'Attribute...' },
      { type: 'waitForText', text: 'Color by attribute' },
      {
        type: 'type',
        selector: '[data-testid="color-by-attribute"]',
        value: 'gene',
        clear: true,
      },
      { type: 'waitForText', text: 'Found' },
      { type: 'press', key: 'Escape' },
      { type: 'delay', ms: 300 },
    ],
  },

  // the parts are 900 wide so the pair is not nearly 4:1
  {
    mode: 'compose',
    name: 'sv_synteny/color_by_attribute_steps',
    parts: ['sv_synteny/color_by_attribute', 'sv_synteny/ortholog_colors'],
    columns: 2,
  },

  // The hosted PIF with its two assemblyNames swapped, so the view draws
  // nothing and raises the warning.
  {
    mode: 'url',
    name: 'sv_synteny/assembly_order_warning',
    url: sessionSpec(HPYLORI_CONFIG, {
      sessionTracks: [
        {
          type: 'SyntenyTrack',
          trackId: 'hpylori_reversed_assembly_names',
          name: '26695 vs CHC155 (assemblyNames reversed)',
          assemblyNames: ['GCF_000307795.1', 'GCF_025998455.1'],
          adapter: {
            type: 'PairwiseIndexedPAFAdapter',
            assemblyNames: ['GCF_000307795.1', 'GCF_025998455.1'],
            pifGzLocation: {
              uri: 'https://jbrowse.org/demos/hpylori/26695_vs_chc155.pif.gz',
              locationType: 'UriLocation',
            },
            index: {
              indexType: 'TBI',
              location: {
                uri: 'https://jbrowse.org/demos/hpylori/26695_vs_chc155.pif.gz.tbi',
                locationType: 'UriLocation',
              },
            },
          },
        },
      ],
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: [['hpylori_reversed_assembly_names']],
          collapseEmptyRows: true,
          levelHeights: [200],
          views: [
            { assembly: 'GCF_000307795.1', loc: 'NC_018939v1' },
            { assembly: 'GCF_025998455.1', loc: 'NZ_AP026446v1' },
          ],
        },
      ],
    }),
    // the icon lands after the canvas reports its empty draw
    readySelector: '[aria-label*="synteny warning"]',
    readyTimeout: 120000,
    allowUnsettled: true,
    viewportHeight: 425,
    clicksOpen: 'the synteny warnings dialog',
    actions: [
      { type: 'click', selector: '[aria-label*="synteny warning"]' },
      { type: 'waitForText', text: 'Synteny warnings' },
      { type: 'delay', ms: 1500 },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // Dotplot / synteny interactions
  // ────────────────────────────────────────────────────────────────────────

  {
    mode: 'url',
    name: 'dotplot_add',
    url: sessionSpec(VOLVOX, { views: [] }),
    readyText: 'Select a view to launch',
    viewportWidth: 900,
    crop: { x: 0, y: 0, width: 900, height: 460 },
    stages: [
      {
        actions: [
          { type: 'click', text: 'Add' },
          { type: 'waitForText', text: 'Dotplot view' },
        ],
        annotations: [
          { type: 'box', anchor: { text: 'Add' } },
          { type: 'box', anchor: { text: 'Dotplot view' } },
        ],
      },
      {
        actions: [
          { type: 'click', text: 'Dotplot view' },
          { type: 'waitForText', text: 'Quick start' },
          { type: 'click', text: 'Manual' },
          { type: 'waitForText', text: 'Select assemblies for dotplot view' },
          { type: 'delay', ms: 1500 },
        ],
      },
    ],
  },

  {
    mode: 'url',
    name: 'synteny_from_dotplot_view',
    // Keep the default 800 height: the drag is a raw canvas coordinate, and a
    // height change moves its target block so the launch never happens.
    url: sessionSpec(DOTPLOT_CONFIG, {
      views: [
        {
          type: 'DotplotView',
          views: [{ assembly: 'peach' }, { assembly: 'grape' }],
          tracks: [
            'grape_peach_synteny_mcscan',
            'grape_peach_synteny_mcscan_simple',
          ],
        },
      ],
    }),
    readySelector: displayPainted('dotplot_webgl_canvas'),
    readyTimeout: 60000,
    actions: [
      // one diagonal block, peach Pp01 vs grape chr1
      { type: 'drag', from: { x: 126, y: 259 }, to: { x: 224, y: 311 } },
      { type: 'waitForText', text: 'Linear synteny view' },
      { type: 'delay', ms: 1000 },
    ],
    // PARK_CURSOR would drop the rubberband and its menu along with the readout
    tooltip: 'hide',
    stages: [
      {},
      // the first close_view button is the dotplot's, views[0]
      {
        actions: [
          { type: 'click', text: 'Linear synteny view' },
          {
            type: 'waitForSelector',
            selector: displayPainted('synteny_canvas'),
          },
          { type: 'waitForAppSettled' },
          { type: 'click', selector: '[data-testid="close_view"]' },
        ],
      },
    ],
  },
  // Below ~30 kb the dispersed repeats black the plot out; above ~100 kb only
  // the palindromes survive. A hang with no error here is a remote fetch.
  {
    mode: 'url',
    name: 'dotplot_self_chry',
    url: sessionSpec('test_data/chry_self/config.json', {
      views: [
        {
          type: 'DotplotView',
          tracks: ['hs1_chrY_self'],
          views: [
            { assembly: 'T2T_chrY', loc: CHRY_MSY_LOCUS },
            { assembly: 'T2T_chrY_self', loc: CHRY_MSY_LOCUS },
          ],
          filter: [{ field: 'length', gte: 25000 }],
        },
      ],
    }),
    // near-square, so the palindrome crossings stay symmetric
    viewportWidth: 1000,
    viewportHeight: 760,
    readySelector: displayPainted('dotplot_webgl_canvas'),
    readyTimeout: 180000,
    // published coordinates: TSPY at chrY:9.05-9.75 Mb in T2T-CHM13v2
    annotations: [
      {
        type: 'box',
        anchor: {
          hLoc: 'chrY:9,050,000-9,750,000',
          vLoc: 'chrY:9,050,000-9,750,000',
        },
      },
      {
        type: 'text',
        text: 'TSPY array',
        fontSize: 17,
        anchor: {
          hLoc: 'chrY:9,050,000-9,750,000',
          vLoc: 'chrY:9,050,000-9,750,000',
          alignY: 'bottom',
          dy: 40,
        },
      },
      {
        type: 'box',
        anchor: {
          hLoc: CHRY_YQ_PALINDROMES,
          vLoc: CHRY_YQ_PALINDROMES,
        },
      },
      {
        type: 'text',
        text: 'Yq palindromes',
        fontSize: 17,
        anchor: {
          hLoc: CHRY_YQ_PALINDROMES,
          vLoc: CHRY_YQ_PALINDROMES,
          alignX: 'left',
          dx: -130,
        },
      },
    ],
  },

  // Not `dotplot_self_chry` reused: that figure already sits above this one on
  // the page. The 100 kb minimum matches the ribbon part below.
  {
    mode: 'url',
    name: 'synteny_self_chry_palindromes_family',
    url: sessionSpec('test_data/chry_self/config.json', {
      views: [
        {
          type: 'DotplotView',
          tracks: ['hs1_chrY_self'],
          views: [
            { assembly: 'T2T_chrY', loc: CHRY_YQ_PALINDROMES },
            { assembly: 'T2T_chrY_self', loc: CHRY_YQ_PALINDROMES },
          ],
          filter: [{ field: 'length', gte: 100000 }],
        },
      ],
    }),
    viewportWidth: 1000,
    // any shorter clips the bottom axis labels
    viewportHeight: 740,
    readySelector: displayPainted('dotplot_webgl_canvas'),
    readyTimeout: 180000,
    annotations: [
      {
        type: 'box',
        anchor: {
          hLoc: CHRY_P_PALINDROME_WINDOW,
          vLoc: CHRY_P_PALINDROME_WINDOW,
        },
      },
      // A compose has no annotation layer, so the arrow can only reach the
      // seam with the lower part.
      {
        type: 'arrow',
        strokeWidth: 3,
        fromAnchor: {
          hLoc: CHRY_P_PALINDROME_WINDOW,
          vLoc: CHRY_P_PALINDROME_WINDOW,
          alignY: 'bottom',
          dy: 16,
        },
        // a selector anchor centres on the canvas and slopes the arrow
        anchor: {
          hLoc: CHRY_P_PALINDROME_WINDOW,
          vLoc: CHRY_P_PALINDROME_WINDOW,
          alignY: 'bottom',
          dy: 122,
        },
      },
    ],
  },

  // Same track and minimum length as the dotplot part above.
  {
    mode: 'url',
    name: 'synteny_self_chry_palindromes_zoom',
    url: sessionSpec('test_data/chry_self/config.json', {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['hs1_chrY_self'],
          encoding: { color: 'strand', opacity: 0.4 },
          mark: { interpolate: 'bump' },
          indels: { encoding: { opacity: 0 } },
          filter: [{ field: 'length', gte: 100000 }],
          levelHeights: [220],
          collapseEmptyRows: true,
          views: [
            {
              assembly: 'T2T_chrY',
              loc: CHRY_P_PALINDROME_WINDOW,
              tracks: [CHRY_GENE_LANE],
            },
            {
              assembly: 'T2T_chrY_self',
              loc: CHRY_P_PALINDROME_WINDOW,
              tracks: [CHRY_GENE_LANE],
            },
          ],
        },
      ],
    }),
    // same width as the dotplot it is composed under
    viewportWidth: 1000,
    viewportHeight: 602,
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 180000,
    // Far left, the one stretch of band carrying only the two colors the pill
    // names. A synteny band has no locus anchor, so the pill anchors on the
    // canvas.
    annotations: [
      {
        type: 'text',
        fontSize: 17,
        maxWidth: 380,
        text: 'a palindrome: a forward match (salmon) and an inverted one (lavender)',
        anchor: {
          selector: '[data-testid="synteny_canvas"]',
          alignX: 'left',
          alignY: 'top',
          dx: 16,
          dy: 18,
        },
      },
    ],
  },

  {
    mode: 'compose',
    name: 'synteny_self_chry_palindromes',
    parts: [
      'synteny_self_chry_palindromes_family',
      'synteny_self_chry_palindromes_zoom',
    ],
  },

  {
    mode: 'url',
    name: 'gallery/yeast_dotplot',
    url: sessionSpec('test_data/yeast_synteny/config.json', {
      views: [
        {
          type: 'DotplotView',
          views: [{ assembly: 'R64' }, { assembly: 'YJM1447' }],
          tracks: ['dotplot_track'],
          autoDiagonalize: true,
        },
      ],
    }),
    readySelector: displayPainted('dotplot_webgl_canvas'),
    readyTimeout: 90000,
  },
  ...launchMenuStills(),
]

// Fixtures for videos/synteny.ts.
export const syntenyVideoFixtures = {
  // two rows naming no assembly open the import form
  emptySyntenyForm: sessionSpec(HPYLORI_CONFIG, {
    views: [{ type: 'LinearSyntenyView', views: [{}, {}] }],
  }),
  grassesLanes: GRASSES_RICE_LANES,
  // the part of each assembly's displayName no other row shares
  strains: {
    top: { label: '26695', assembly: 'GCF_000307795.1' },
    middle: { label: 'CHC155', assembly: 'GCF_025998455.1' },
    bottom: { label: 'J99', assembly: 'GCF_000982695.1' },
  },
  // The state `multiway_synteny/blocks_one_vs_all` captures. A plain LGV: a
  // rubberband in a LinearSyntenyView row offers no Launch submenu.
  restackLanes: sessionSpec(
    'https://jbrowse.org/demos/grape_peach_cacao/config.json',
    {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GCF_030704535.1',
          loc: 'chr11:778,000-866,000',
          tracks: [
            {
              trackId: 'GCF_030704535.1-ncbiRefSeq',
              filter: ['geneLike'],
              displayMode: 'compact',
              showLabels: 'auto',
            },
            {
              trackId: 'grape_peach_cacao_blocks',
              facet: 'mateAssembly',
              pileup: { mark: { height: 14 } },
              height: 140,
            },
          ],
        },
      ],
    },
  ),
  // The span must hold a .blocks row whose peach and cacao cells both resolve
  // (the grape locus at 836 kb), or the dialog opens on one panel.
  restackSpan: { start: 'chr11:800,000', end: 'chr11:850,000' },
  // the assembly the drag is made on, so row 0 of the dialog's list
  restackAnchor: 'GCF_030704535.1',
  allVsAllLanes: ECOLI_ONE_VS_ALL_LANES,
  roundTripStart: ECOLI_ROUND_TRIP_START,
  mafRows: ECOLI_MAF_ROWS,
  mafTrackId: 'ecoli_pggb_maf',
  mafRowSpan: { start: 'chr:800,300', end: 'chr:804,100' },
  // Sakai's alignments on both sides of its prophage must fall within the
  // launch's outlier reach (1.5 selections from the median)
  roundTripSpan: { start: 'chr:787,000', end: 'chr:828,000' },
  // The composite's drag span; every strain aligns across it, so the dialog
  // opens on all five rows.
  allVsAllSpan: { start: 'chr:800,000', end: 'chr:808,000' },
  // The dialog lists mates in the track's `assemblyNames` order, so IAI39
  // opens last. Each move renames its button: MoveButton's aria-label carries
  // the panel's position.
  allVsAllMoved: 'IAI39',
  // Collapsed, the three chain blocks here merge into one row and a
  // right-click lands on whatever fragment is under the cursor.
  liftoverLgv: sessionSpec(UCSC_HG38_CONFIG, {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'hg38',
        // the window `synteny_hg38_hs1_tnnt3` frames, so the launch lands on it
        loc: 'chr11:1,881,000-1,955,000',
        tracks: [
          {
            trackId: 'hg38-ncbiRefSeqCurated',
            geneGlyphMode: 'longestCoding',
            height: 90,
          },
          {
            trackId: 'hg38_to_hs1_liftOver',
            collapseSections: false,
            pileup: { mark: { height: 14 } },
            height: 70,
          },
        ],
      },
    ],
  }),
  // Inside TNNT3: over the deletion left of it, the menu grows an "Open
  // deletion details" row for the CIGAR op under the cursor.
  liftoverBlock: 'chr11:1,925,000',
  // `mcscan_synteny/dotplot` minus `autoDiagonalize`, so the reorder is still
  // to happen on camera
  unorderedDotplot: sessionSpec(GRAPE_PEACH_CONFIG, {
    views: [
      {
        type: 'DotplotView',
        views: [{ assembly: PEACH }, { assembly: GRAPE }],
        tracks: ['grape_peach_anchors'],
      },
    ],
  }),
}

function launchMenuStills(): ScreenshotSpec[] {
  return [
    {
      mode: 'url',
      name: 'multiway_synteny/ecoli_alignment_menu',
      url: ECOLI_ONE_VS_ALL_LANES,
      readySelector: displayPainted('pileup-display'),
      readyTimeout: 120000,
      viewportHeight: 440,
      tooltip: 'hide',
      clicksOpen: "an alignment's context menu at its Launch submenu",
      actions: [
        // canvas-drawn lanes take only a locus and a depth
        {
          type: 'rightclick',
          anchor: { trackId: 'ecoli_ava', loc: 'chr:801,000', fracY: 0, dy: 8 },
        },
        { type: 'waitForText', text: 'Open feature details' },
        // the Launch submenu arrives a fetch after the menu
        ...menuCascade(['Launch', 'Linear synteny view, all assemblies here']),
        { type: 'hover', text: 'Linear synteny view with' },
        { type: 'delay', ms: 500 },
      ],
      annotations: [
        { type: 'box', anchor: { text: 'Linear synteny view with' } },
        {
          type: 'box',
          anchor: { text: 'Linear synteny view, all assemblies here' },
        },
        { type: 'box', anchor: { text: 'at the matching region' } },
      ],
    },
    {
      mode: 'url',
      name: 'multiway_synteny/lane_header_menu',
      url: sessionSpec(
        'https://jbrowse.org/demos/grape_peach_cacao/config.json',
        {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'GCF_030704535.1',
              loc: 'chr11:778,000-866,000',
              tracks: [
                {
                  trackId: 'grape_peach_cacao_blocks',
                  type: 'MultiWaySyntenyDisplay',
                  rows: {
                    sort: ['GCF_000346465.2', 'GCF_000208745.1', 'poplar'],
                  },
                  height: 260,
                },
              ],
            },
          ],
        },
      ),
      readySelector: displaySettled('multiway-synteny-display'),
      readyTimeout: 120000,
      viewportHeight: 520,
      tooltip: 'hide',
      clicksOpen: "a lane's context menu",
      actions: [
        {
          type: 'rightclick',
          selector: '[data-testid="multiway-lane-label-GCF_000346465.2"]',
        },
        { type: 'waitForText', text: 'Re-anchor on peach' },
        { type: 'delay', ms: 500 },
      ],
      annotations: [
        { type: 'box', anchor: { text: 'Open peach at the matching region' } },
        { type: 'box', anchor: { text: 'Re-anchor on peach' } },
      ],
    },
    {
      mode: 'url',
      name: 'maf_row_menu',
      url: ECOLI_MAF_ROWS,
      readySelector: displayPainted('maf-display'),
      readyTimeout: 180000,
      viewportHeight: 560,
      tooltip: 'hide',
      actions: [
        // ends short of the tour's span so the menu opens inside the frame
        {
          type: 'drag',
          fromAnchor: {
            loc: 'chr:800,800',
            trackId: 'ecoli_pggb_maf',
            band: '[data-testid="maf-rows"]',
            fracY: 0.02,
          },
          toAnchor: {
            loc: 'chr:802,400',
            trackId: 'ecoli_pggb_maf',
            band: '[data-testid="maf-rows"]',
            fracY: 0.98,
          },
        },
        { type: 'waitForText', text: 'Linear synteny view, K12 vs...' },
        { type: 'hover', text: 'Open aligned genome at the matching region' },
        { type: 'waitForText', text: 'CFT073 chr:' },
        { type: 'delay', ms: 500 },
      ],
      annotations: [
        {
          type: 'box',
          anchor: { text: 'Open aligned genome at the matching region' },
        },
      ],
    },
  ]
}
