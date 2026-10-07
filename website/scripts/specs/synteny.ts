import { displayPainted, displaySettled } from '@jbrowse/browser-test-utils'

import {
  HG38_HS1_CONFIG,
  UCSC_HG38_CONFIG,
  VOLVOX,
  cgiabUrl,
  hpyloriUrl,
  menuCascade,
  sessionSpec,
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

export const DOTPLOT_CONFIG = 'test_data/config_dotplot.json'
export const HS1_MM39_CONFIG = 'test_data/hs1_vs_mm39/config.json'
const AMYLASE_CONFIG = 'test_data/amylase/config.json'
const SYRI_CONFIG = 'test_data/syri/config.json'
// the stack order, reference first, and SyRI's types in plotsr's order
const SYRI_ACCESSIONS = ['Col-0', 'Ler', 'Cvi', 'Eri', 'Kyo', 'Sha']
const SYRI_TYPES = ['SYN', 'INV', 'TRANS', 'INVTR', 'DUP', 'INVDP']
const AMYLASE_HG38 = 'chr1:103,520,894-103,832,637'

// Three H. pylori strains stacked top-to-bottom, with a synteny track between
// each adjacent pair and a gene annotation track on each genome, used by the
// synteny_visualization.md tutorial.
//
// `geneColor` is the display's `color` slot, written on all three gene tracks at
// once: the "Color by attribute" dialog writes `{ field: '<attr>' }`, and in
// bacteria the `gene` attribute is the ortholog id, so the same symbol takes the
// same color in every panel. Omitted by default, which encodes byte-identically
// to the version without the parameter.
export function hpyloriSyntenyWithGenes({
  geneColor,
}: { geneColor?: { field: string } } = {}) {
  // showOnlyGenes collapses each locus to its gene glyph (no CDS/mRNA
  // sub-features), so the lane reads as a tidy row of genes rather than nested
  // boxes
  const geneTrack = (trackId: string) => ({
    trackId,
    // the hosted config can't be read at build time, so the figure recipe only
    // knows which display a `color` expression belongs to if the spec says
    type: 'LinearBasicDisplay',
    showOnlyGenes: true,
    // no key: each gene already prints its symbol, and a key per panel lists a
    // different subset and covers the genes at the right edge
    ...(geneColor ? { color: geneColor, showLegend: false } : {}),
  })
  return hpyloriUrl({
    views: [
      {
        type: 'LinearSyntenyView',
        // curved bezier ribbons connect the aligned blocks more legibly than
        // straight quadrilaterals across the three stacked strains
        drawCurves: true,
        // 2-D form: tracks[i] is the synteny shown between views[i] and
        // views[i+1]. A flat string[] is treated as a single level-0 entry, so
        // the level-1 band (chc155 vs j99) stayed empty — this nests each track
        // onto its own adjacent-pair level.
        tracks: [['26695_vs_chc155.pif'], ['chc155_vs_j99.pif']],
        views: [
          {
            loc: 'NC_018939v1:672000-782000',
            assembly: 'GCF_000307795.1',
            tracks: [geneTrack('GCF_000307795.1-ncbiGff')],
          },
          {
            loc: 'NZ_AP026446v1:780000-890000',
            assembly: 'GCF_025998455.1',
            tracks: [geneTrack('GCF_025998455.1-ncbiGff')],
          },
          {
            // j99 aligns to chc155 in inverted orientation, so the [rev]
            // suffix flips this panel (declarative loc-string reverse) to
            // straighten the level-1 ribbons — otherwise they cross in an X
            loc: 'NZ_CP011330v1:305000-415000[rev]',
            assembly: 'GCF_000982695.1',
            tracks: [geneTrack('GCF_000982695.1-ncbiGff')],
          },
        ],
      },
    ],
  })
}

// Human (hg38) vs chimp (panTro6) synteny from the hosted UCSC hg38->panTro6
// liftOver PIF + RefSeq genes + RepeatMasker on jbrowse.org/ucsc.
export const HG38_PANTRO6_CONFIG = 'test_data/hg38_panTro6_synteny/config.json'

// RB1 (retinoblastoma tumor suppressor): a full-length ~6 kb L1HS — the youngest,
// still-active human LINE-1 subfamily — sits in an intron in human but is absent
// at the orthologous chimp intron (chimp has only old L1PA13/14/16). It is
// flanked by repeats conserved in both species (L1ME3A upstream, MER21C
// downstream), so it renders as a clean human-specific transposon insertion; the
// RepeatMasker track labels it "L1HS" exactly at the insertion.
export const RB1_L1_LOCUS = {
  hg38: 'chr13:48,459,000-48,477,500',
  panTro6: 'chr13:29,450,000-29,459,000',
}

// PICALM (Alzheimer's-associated): a ~0.3 kb AluYb8 — a young, human-specific Alu
// subfamily and the commonest kind of human-specific mobile-element insertion —
// dropped in downstream of a conserved AluY; the orthologous chimp interval keeps
// the AluY but has no AluYb8 (none anywhere in chimp PICALM). Shows that even a
// small lineage-specific insertion reads clearly as an indel.
export const PICALM_ALU_LOCUS = {
  hg38: 'chr11:85,978,000-85,986,000',
  panTro6: 'chr11:81,727,500-81,735,000',
}

// A hosted liftOver chain is one chromosome-scale block; drawn zoomed in it
// exercises the oversized-block viewport clip (the worker trims the block to the
// visible slice, else the ribbon would vanish). "Transparent indels" (cigarMode
// 'matches') shows the indel as a see-through gap, "Colored indels" ('full') as
// a painted wedge.
export function hg38ChimpSynteny(
  cigarMode: 'matches' | 'full',
  locus: { hg38: string; panTro6: string } = RB1_L1_LOCUS,
) {
  // collapse each gene to its single longest coding transcript: MANE isn't
  // available for panTro6, so geneGlyphMode 'longestCoding' is the way to cut
  // the dense NCBI isoform stacks on both genomes (reviewer)
  // NORMAL FEATURE HEIGHT, and the lane sized to what it draws. This used to
  // pin `featureHeight: 18` against an earlier "reads as a bare sliver" note,
  // and at these loci that is a gene reduced to one transcript with a handful of
  // exons 15-30 px wide — so an 18 px body draws each exon as a SQUARE, next to
  // a RepeatMasker lane whose elements are ordinary flat bars (review: "the
  // canvasfeatures are oddly 'tall'"). The two lanes are the same renderer and
  // there is no reason for the gene one to be at a different scale.
  //
  // `heightMode: 'grow'` for the same reason the repeat lanes have it, and it is
  // worth saying that it buys no pixels HERE: probed on the live model, both
  // gene lanes come out at 50, which is the grow floor rather than the content's
  // own height, and is what the fixed slot already gave them. It is here so the
  // lane follows its content if the locus ever holds more than one collapsed
  // transcript — the empty strip under one row is the floor, not a setting.
  const genes = (id: string) => ({
    trackId: id,
    geneGlyphMode: 'longestCoding',
    heightMode: 'grow',
  })
  // RepeatMasker: 'grow' height mode — the track auto-sizes to exactly the few
  // rows of repeats at these TE loci, so it stays compact without crowding the
  // gene track, while every element keeps its NORMAL feature height (no fit-mode
  // scaling that inflates the boxes) and every name is drawn (no fit-ladder label
  // decimation). Reviewer: repeats should be normal-height and compact but still
  // labeled (SVA_F, L1HS, AluY… at the insertions) — not the tall, label-dropping
  // 'fit' band.
  //
  // `displayMode: 'compact'` on top of that (review on both TE figures: "try to
  // improve y-screen real estate using compact renderings"). These lanes are
  // what the frames spend their height on -- every element gets a row of its
  // own because its label widens its footprint, so each RepeatMasker band packs
  // five or six rows. Compact is a 0.6x body with proportionally smaller label
  // text and tighter row padding (HEIGHT_MULTIPLIERS / ROW_PADDING in
  // glyphUtils), which is the one compactness step that keeps the names: only
  // `collapsed` forces labels off, and the names are the point here.
  const rmsk = (id: string) => ({
    trackId: id,
    heightMode: 'grow',
    displayMode: 'compact',
  })
  return sessionSpec(HG38_PANTRO6_CONFIG, {
    views: [
      {
        type: 'LinearSyntenyView',
        cigarMode,
        drawCurves: true,
        tracks: [['hg38_panTro6_synteny']],
        views: [
          {
            assembly: 'hg38',
            loc: locus.hg38,
            // RepeatMasker last so it sits against the synteny band, where its
            // elements line up with the indels
            tracks: [genes('hg38-genes'), rmsk('hg38-rmsk')],
            trackLabels: 'offset',
          },
          {
            assembly: 'panTro6',
            loc: locus.panTro6,
            // RepeatMasker first so it sits against the synteny band above it
            tracks: [rmsk('panTro6-rmsk'), genes('panTro6-genes')],
            trackLabels: 'offset',
          },
        ],
      },
    ],
  })
}

// PAR1 through the end of the euchromatic male-specific region of T2T chrY,
// which is what the self-alignment covers (Yq12 beyond it is DYZ satellite).
const CHRY_MSY_LOCUS = 'chrY:2,700,000-26,600,000'

// The P1-P5 Yq palindrome family, from the T2T-CHM13 Y paper (Rhie et al. 2023)
// rather than read off a picture. Shared by the box on the whole-MSY dotplot and
// by the synteny view that frames only this, so the two figures are provably
// about the same interval.
const CHRY_YQ_PALINDROMES = 'chrY:21,200,000-26,000,000'

// One palindrome out of that family, framed with ~30 kb of flank. Read off the
// alignment rather than off a paper: `tabix hs1_chrY_self.pif.gz
// tchrY:21200000-26000000` has exactly four inverted alignments over 100 kb
// whose ends both land inside the box above, and this is the 401,640 bp one at
// chrY:22,368,211-22,769,851 -- an interval aligned to its own reverse
// complement, which is what a palindrome is.
const CHRY_P_PALINDROME_WINDOW = 'chrY:22,330,000-22,810,000'

// THE GENES, ON BOTH PANELS (review: "if showing gene features would make it
// look cooler we can consider"). They do, and not decoratively: this is the
// RBMY1 palindrome, and each arm carries its own copies of the family, so the
// two lanes read RBMY1B, RBMY1A1, TTTY13 down one side of the centre and
// RBMY1D, RBMY1E back up the other. The mirror is the thing the ribbons are
// drawing, stated a second way by an annotation the alignment had no part in.
//
// It needed two lines of fixture config rather than a new file. The T2T-CHM13
// GFF we already host is keyed on RefSeq accessions (`NC_060948.1`) while this
// fixture's assembly is a committed `chrY.chrom.sizes`, so the track resolved
// to nothing until the assemblies got a `refNameAliases` mapping the two --
// which is also why a note on the retired hprc_chm13_allele's hs1 gene lane
// said that file "has nothing in this window". It may well have.
//
// `showOnlyGenes` because the palindrome's members each carry a stack of
// isoforms and what this lane is read for is where a NAME sits relative to the
// centre.
const CHRY_GENE_LANE = {
  trackId: 'hs1_chrY_genes',
  type: 'LinearBasicDisplay',
  showOnlyGenes: true,
  geneGlyphMode: 'longestCoding',
  displayMode: 'compact',
  // NAMES ONLY. The default 'auto' adds each gene's description at this
  // density, and RefSeq's are full sentences ("RNA binding motif protein
  // Y-linked family 1 member A1"), so the lane came back as two rows of blue
  // prose under one row of glyphs. What the lane is read for is which SYMBOL
  // sits where relative to the palindrome's centre.
  showLabels: 'name',
  height: 60,
}

// hg38 vs T2T-CHM13 (hs1) at TNNT3, the locus the genomes.jbrowse.org demo
// session parks on. `view` carries the ribbon-drawing settings that differ
// between the default figure and the curved/transparent-indel one.
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
        color: { field: 'strand' },
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
            // same window shifted by the +83.7 kb hg38->hs1 offset the demo
            // session's two views were parked at, so the two panels frame the
            // same genes
            assembly: 'hs1',
            loc: 'chr11:1,964,700-2,038,700',
            // the hs1 GFF is RefSeq All plus regulatory/"biological region"
            // features, so showOnlyGenes is what makes it read like the
            // curated hg38 track above
            tracks: [
              {
                trackId: 'hs1-genes',
                geneGlyphMode: 'longestCoding',
                showOnlyGenes: true,
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

// Genes over repeats in each panel of the finished FTO comparison, one entry per
// track. RefSeq Curated is the same gene track (and the same longest-isoform
// glyph) the LGV the launch came from is showing, and the human pair matches
// what that view's tracks were copied into the anchor panel as — so the two
// bottom frames differ in the chimp panel and nothing else.
//
// The heights are the figure's, which is the point of declaring this frame
// rather than clicking it together: pinned, they hold the two frames to roughly
// one height instead of the default four times over. Repeat labels stay ON here
// (they are off in the launching view, which is 4x this window): at 18 kb this
// interval holds a dozen elements, and the name on the one in the gap is what
// makes the figure's claim checkable rather than asserted.
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
  // `panTro6-ncbiRefSeq`, not the Curated track the human panel uses: RefSeq
  // Curated is a human-first product and chimp's copy of it is sparse enough to
  // leave this window empty, which would put a blank lane opposite FTO.
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

// shared framing for the TNNT3 figures: remote 2bit genomes + hosted PIF/GFF,
// so allow headroom, and equal heights so the two-part stack is clean
const TNNT3_FRAME = {
  mode: 'url' as const,
  viewportWidth: 1200,
  viewportHeight: 520,
  readySelector: displayPainted('synteny_canvas'),
  readyTimeout: 120000,
}

const TNNT3_GENE_PAGE = 'https://staging.genomes.jbrowse.org/gene/?gene=TNNT3'
const STAR_LINK = 'a[href*="_liftOver_multiway"]'

// The session STAR_LINK carries (starUrl in jb2hubs
// website/src/components/multiSyntenyDrilldown.ts), cut with Lanes → Choose
// lanes to eight genomes from chimp to platypus, ribbons coloured by strand.
// The full link opens 26 lanes, 34 px each, which drew as a grey wall. These
// eight are all drawn forward but platypus, so a blue ribbon is an inversion
// against hg38 and not a contig the assembly happened to store reversed.
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
  return sessionSpec(
    encodeURIComponent('https://jbrowse.org/ucsc/hg38/config-staging.json'),
    {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'NC_000011.10:1822626-2024102',
          tracks: [
            {
              trackId: 'hg38_liftOver_multiway',
              type: 'MultiWaySyntenyDisplay',
              rows: { domain: lanes, kept: lanes },
              ribbonColor: { field: 'strand' },
              height: (lanes.length + 1) * 60,
            },
          ],
        },
      ],
    },
  )
}

// A hosted reference's star opened on the lanes named, in that order, with the
// reference's gene track above it: the route the tutorial's Lanes menu takes,
// pinned as a link
function hostedStarSession(
  db: string,
  loc: string,
  lanes: string[],
  display: Record<string, unknown> = {},
  genes: Record<string, unknown> = {},
) {
  return sessionSpec(
    encodeURIComponent(`https://jbrowse.org/ucsc/${db}/config-staging.json`),
    {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: db,
          loc,
          tracks: [
            { trackId: `${db}-ncbiRefSeq`, ...genes },
            {
              trackId: `${db}_liftOver_multiway`,
              type: 'MultiWaySyntenyDisplay',
              rows: { domain: lanes, kept: lanes },
              height: (lanes.length + 1) * 34,
              ...display,
            },
          ],
        },
      ],
    },
  )
}

// The two files one MCScan run writes, each drawn on its own and stacked into
// one figure. Same window and same view settings in both parts, so the only
// variable is which file the adapter is reading: `.anchors` puts a ribbon on
// every orthologous gene pair, `.anchors.simple` puts one ribbon on each block
// those pairs make up. The tutorial stated that difference in prose and showed
// one figure with both tracks on at once, where neither is separable.
//
// The window is a run of seven consecutive MCScan blocks, read out of the
// .anchors.simple file itself: grape chr9 56,558-7,626,065 against peach Pp03
// 2,204,428-6,833,100, five collinear and two inverted, in the same order on
// both genomes. A window of ONE block — which this figure used to frame — makes
// `.anchors.simple` a single ribbon spanning the entire band, i.e. a solid slab
// with nothing to compare it against; seven blocks separated by gaps are seven
// ribbons, which is what "one ribbon per block" means. Straight ribbons, not
// curved: within a collinear block a curve only bows a flat correspondence.
// No strand key: the ribbons already show orientation.
//
// Neither panel carries a track: the subject is the ribbon band, so
// collapseEmptyRows drops each row to its scalebar rather than a "No tracks
// active" block.
function mcscanFilePartSpecs(): ScreenshotSpec[] {
  // The second frame draws BOTH files on the one synteny level, per review
  // ("both tracks blended"). That reads only because the window holds several
  // blocks: the view's 0.2 alpha makes each block a pale trapezoid, and the gene
  // ribbons it was built from paint darker inside it, with the between-block
  // gaps left empty by the .simple file but crossed by stray single anchors.
  // Blocks first in the level so the gene threads land on top of them.
  const part = (name: string, trackIds: string[], label: string) => ({
    mode: 'url' as const,
    name,
    url: sessionSpec(DOTPLOT_CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: [trackIds],
          drawCurves: false,
          levelHeights: [260],
          collapseEmptyRows: true,
          views: [
            {
              assembly: 'grape',
              loc: 'chr9:1-7,700,000',
              tracks: [],
            },
            {
              assembly: 'peach',
              loc: 'Pp03:2,100,000-6,900,000',
              tracks: [],
            },
          ],
        },
      ],
    }),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 60000,
    // two collapsed scalebar rows around one 260px band
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
      ['grape_peach_synteny_mcscan'],
      '.anchors open; one ribbon per gene pair',
    ),
    part(
      'mcscan_synteny/anchors_simple',
      ['grape_peach_synteny_mcscan_simple', 'grape_peach_synteny_mcscan'],
      '.anchors and .anchors.simple open; one ribbon per gene\nrendered on top of chained synteny blocks',
    ),
  ]
}

// The state that flow starts in, shared with `syntenyVideoFixtures.allVsAllLanes`
// below so the tour of the route and the stills of it open the same app.
//
// A PLAIN LGV, which is the launch's own rule rather than a convenience:
// `launchableTracks` reads the LAUNCHING VIEW's open tracks, and a
// LinearSyntenyView keeps its synteny track on the level between two genome rows
// rather than on either row, so a rubberband on a row of this page's stacked
// figure raises no Launch submenu at all. This view has ecoli_ava open, so it has
// the offer -- and the lanes it draws are the reading the section that carries
// the figure is about.
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
      scales: { y: { zero: false } },
      marks: [{ mark: 'rule', encoding: { y: 'identity', size: 2 } }],
    },
  ],
}

const ECOLI_ONE_VS_ALL_LANES = sessionSpec(
  encodeURIComponent('https://jbrowse.org/demos/ecoli_pangenome/config.json'),
  {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'K12',
        loc: 'chr:795,000-815,000',
        tracks: [
          {
            trackId: 'ecoli_ava',
            type: 'LGVSyntenyDisplay',
            facet: 'mateAssembly',
            hideSelfAlignments: true,
            featureHeight: 14,
            height: 135,
          },
        ],
      },
    ],
  },
)

// The grasses multi-way lanes at the rice window the maize-WGD stacked figure
// reads, shared between the `multiway_synteny/grasses_rice_lanes` still and
// the track-menu launch tour so the film and the figure open the same app.
// Where the round trip starts: the same K-12 lanes, with the graph's rGFA
// segments lane beside them — the two datasets the one rubberband offers a
// view of, and the segments lane is what the launched stack's K-12 row carries
// into the graph launch (anchorPanelTracks copies every non-synteny track).
//
// Wider than the launch tour's window, around K-12 chr:807,327, between ybhC
// and ybhB. all_vs_all.paf breaks Sakai's alignment there, 855,696-891,123
// before and 929,694-954,608 after, and Sakai.gff.gz annotates the 38.5 kb
// between as phage terminase, tail and Nle effector genes.
const ECOLI_ROUND_TRIP_START = sessionSpec(
  encodeURIComponent('https://jbrowse.org/demos/ecoli_pangenome/config.json'),
  {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'K12',
        loc: 'chr:783,000-832,000',
        tracks: [
          {
            trackId: 'ecoli_ava',
            type: 'LGVSyntenyDisplay',
            facet: 'mateAssembly',
            hideSelfAlignments: true,
            featureHeight: 14,
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

// Where the MAF-row launch starts: the pggb alignment over three of its own
// blocks on K-12, narrow enough that every strain's row is a run of bases
// rather than a bar, with the gene lane that names what the rows are aligning.
//
// EVERY STRAIN ALIGNS SOMEWHERE IN THE WINDOW, and one of them not everywhere.
// `ecoli_pggb.maf.bed.gz` carries one row per strain that aligns and no row at
// all for one that does not; a menu is built from the rows the drag covers, so
// a window inside an accessory island lists one strain. chr:1,446,000 is such a
// window -- the paa island -- and it is the window this tour was first written
// at. Here the blocks at 800,105 and 803,325 carry all five, and the two
// between them carry no IAI39: all_vs_all.paf has IAI39 running 768 bp where
// K-12 runs 800,701-803,686, which is ybhH and ybhI.
const ECOLI_MAF_ROWS = sessionSpec(
  encodeURIComponent('https://jbrowse.org/demos/ecoli_pangenome/config.json'),
  {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'K12',
        loc: 'chr:800,100-804,300',
        tracks: [
          {
            trackId: 'K12_genes',
            type: 'LinearBasicDisplay',
            showOnlyGenes: true,
            displayMode: 'compact',
          },
          // Tall enough that a row is a band a drag can be aimed at: the
          // display fits its rows to whatever height it is given, and at the
          // default the five strains and the coverage band share ~80px.
          {
            trackId: 'ecoli_pggb_maf',
            type: 'LinearMafDisplay',
            showTree: true,
            height: 150,
          },
        ],
      },
    ],
  },
)

const GRASSES_RICE_LANES = sessionSpec(
  encodeURIComponent(
    'https://jbrowse.org/demos/orthofinder_grasses/config.json',
  ),
  {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'rice',
        loc: '3:31,590,000-31,775,000',
        tracks: [
          {
            trackId: 'rice_genes',
            type: 'LinearBasicDisplay',
            showOnlyGenes: true,
            displayMode: 'compact',
          },
          {
            trackId: 'grasses_orthogroups',
            type: 'MultiWaySyntenyDisplay',
            rows: { domain: ['sorghum', 'brachypodium', 'setaria', 'maize'] },
            height: 320,
          },
        ],
      },
    ],
  },
)

// The gene-level lane stack two figures share: the zoom still, and the
// clicked frame taken in the same window so the two are the same view
const LGV_TRACK_ZOOM_SESSION = sessionSpec(
  encodeURIComponent('https://jbrowse.org/demos/grape_peach_cacao/config.json'),
  {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'GCF_030704535.1',
        loc: 'chr11:828,000-866,000',
        tracks: [
          {
            trackId: 'GCF_030704535.1-ncbiRefSeq',
            type: 'LinearBasicDisplay',
            showOnlyGenes: true,
            displayMode: 'compact',
            showLabels: 'auto',
          },
          {
            trackId: 'grape_peach_cacao_blocks',
            type: 'MultiWaySyntenyDisplay',
            rows: {
              domain: [
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

// The three frames of the "launch a synteny view from a selection" flow, all
// starting from the same one-vs-all lane session and the same rubberband drag
// over ~chr:800,000-808,000 of its 20 kb window. Each frame carries the actions
// of the ones before it (a capture is one page load, so a later frame has to
// redo the chain) and stops at its own state, with only the height that state
// needs.
function launchFromSelectionParts(): ScreenshotSpec[] {
  const url = ECOLI_ONE_VS_ALL_LANES
  // the drag is on the scalebar strip above the tracks; the menu it raises
  // collects the launch under "Launch", which the selection frame shows opened
  // so the figure names the entry rather than just the group. This config
  // carries three all-vs-all datasets, and the choice between them is a field
  // in the dialog rather than a menu of them — the dialog opens on the one this
  // view has open. The menu rows go by testid rather than by text: the track's
  // name is also its label in the view above, and a text match resolves to the
  // first visible match, which is that label rather than the row.
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
      // the lanes plus the selection's own menu, nothing below it
      viewportHeight: 420,
      actions: select,
    },
    {
      ...base,
      name: 'multiway_synteny/ecoli_launch_dialog',
      // The dialog centers in the viewport and MUI caps its paper at the
      // viewport minus 64px, past which the content scrolls — so this is sized
      // for the whole dialog, buttons included. At 620 the action row was below
      // that cap and the frame cut it off mid-button, which since the launch
      // grew a second way out ("Replace current view" beside "Open in new
      // view") is the row worth showing.
      //
      // 760 -> 676 with the dialog's own shrink (review: "can the dialog
      // y-screen real estate be improved by potentially adding an 'advanced'
      // dropdown?"). The four option fields below the panel list are now an
      // `Advanced` disclosure, collapsed — see AdvancedLaunchOptions in
      // plugins/linear-comparative-view. The run reported exactly 84 css px
      // blank below the shorter dialog.
      //
      // 676 -> 622 when the dataset selector became a line of text. This config
      // declares four synteny tracks over K12, and the dialog used to offer all
      // four; it offers what the view has OPEN, which here is the one, so there
      // is nothing to select between (see launchableTracks). The run reported 62
      // css px blank, less the spacing the line took back off the select.
      viewportHeight: 622,
      actions: [...select, ...openDialog],
    },
    {
      ...base,
      name: 'multiway_synteny/ecoli_launch_result',
      // five genome rows (each collapsed to its ruler, since the launch gives
      // them no tracks) and the four bands between them
      viewportHeight: 620,
      actions: [
        ...select,
        ...openDialog,
        // "Replace current view", the dialog's other way out: the launched view
        // takes the linear view's slot, so the frame is the result rather than
        // mostly the source. (This used to be Submit followed by a click on
        // close_view, which is the same two steps done by hand.)
        //
        // This click is where the run's `[mobx-state-tree] ... no longer part of
        // a state tree` warns come from (plus `[findParentThat] node has no
        // parent`), and they are benign. Replacing destroys the LGV subtree
        // while its observer components are still mounted — React unmounts in
        // the commit after the action — so MobX's staleness check re-evaluates
        // their dependencies across the dead nodes: `view.height` walks tracks →
        // displays. MST's livelinessChecking defaults to 'warn', so nothing
        // throws and the reads feed a render that never commits. They carry
        // `Action: '/session.replaceView()'` because MST leaves that action
        // context set while MobX flushes reactions at the end of the action, and
        // they print interleaved under other specs' [n/total] lines because the
        // generator runs four browsers at once — the `[name] browser[warn]:`
        // prefix is the attribution, not the counter above them.
        { type: 'click', text: 'Replace current view' },
        {
          type: 'waitForSelector',
          selector: displayPainted('synteny_canvas'),
        },
        { type: 'delay', ms: 4000 },
        // No palette menu (reviewer). The launched view already draws the
        // PAF's CIGAR (cigarMode defaults to 'full', and all_vs_all.paf is
        // built with `minimap2 -c`), so the wedges inside these ribbons are the
        // insertions and deletions; the menu is a full-height overlay across
        // the left half of the frame, which costs more of the five-row stack
        // than the naming is worth here.
      ],
    },
  ]
}

// Oat's groups 4, 5 and 7, not all seven. The whole genome is a 21x21 grid
// where every segment is a few pixels; three groups make it 9x9, and oat's
// off-group cells are everywhere, so any subset shows them. Hexaploid oat's
// subgenomes are A, C and D.
//
// A restriction and not a zoom: `displayedRegionNames` per axis changes WHAT
// the axis holds, the axes relayout, and showAllRegions fits the result, so
// the ribbons are re-drawn rather than magnified.
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

// Peach chr1 over grape chr1 from the grape/peach/cacao MCScan blocks, which is
// the case the off-screen mate marks exist for. 3,796 anchors are anchored in the
// visible peach window; 1,029 have a grape mate on grape chr1 and get a ribbon.
// The other 2,767 go to nine other grape chromosomes — the gamma paleohexaploidy —
// and a view that draws only ribbons says nothing about them at all.
//
// Two independent sessions rather than one capture driving the menu, so each
// state stays an openable live link and the pair cannot drift from either.
function peachGrapeChr1({
  marks,
  peachLoc = 'chrG1',
  grapeLoc = 'chr1',
}: { marks?: boolean; peachLoc?: string; grapeLoc?: string } = {}) {
  return sessionSpec(
    encodeURIComponent(
      'https://jbrowse.org/demos/grape_peach_cacao/config.json',
    ),
    {
      views: [
        {
          type: 'LinearSyntenyView',
          // stated in the OFF state, which is the one that now differs from the
          // default: this pair exists to show the contrast, so the frame
          // without the marks has to ask for their absence rather than inherit
          // it
          ...(marks ? {} : { showOffscreenMates: false }),
          // hideNoTracksActive on both rows: neither carries a track at
          // whole-chromosome zoom, so each was painting the LGV's "No tracks
          // active / OPEN TRACK SELECTOR" block — two dark call-to-action
          // buttons in the middle of a figure whose subject is a strip of marks
          // a few pixels tall.
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

// K-12 against four E. coli strains: mate lanes on the K-12 row over four
// ribbon bands, each `levelHeight` px tall
export function ecoliOneVsAllUrl(levelHeight: number) {
  return sessionSpec(
    encodeURIComponent('https://jbrowse.org/demos/ecoli_pangenome/config.json'),
    {
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
                  type: 'LGVSyntenyDisplay',
                  facet: 'mateAssembly',
                  // The K12 lane can hold no self-alignment — all_vs_all.paf
                  // is built with `minimap2 -X`, which skips each sequence's
                  // own diagonal — so it is hidden rather than explained away.
                  hideSelfAlignments: true,
                  // Per-base mismatches are sub-pixel at 3.2kb/px — thousands
                  // of inter-strain SNPs, each drawn at a 1px floor, painted
                  // every lane a solid brown-and-purple wall and buried the
                  // block structure the figure is about.
                  showMismatches: false,
                  // Thicker than the default bar: at 3.2kb/px the information
                  // is the WHITE, and a 3px gap in a 7px bar is not a gap
                  // anyone sees.
                  featureHeight: 20,
                  height: 100,
                },
              ],
            },
            // IAI39 SECOND, not last as in the standalone multi-way figure:
            // the bands are between adjacent rows, so this is the only order
            // where a K12<->IAI39 band exists at all. Its crossings then sit
            // directly under the blue stretches of the IAI39 lane above, on
            // the same K12 axis — which is the whole reason the two
            // representations are in one frame.
            { assembly: 'IAI39' },
            { assembly: 'Sakai' },
            { assembly: 'CFT073' },
            { assembly: 'NCTC86' },
          ],
          tracks: [['ecoli_ava'], ['ecoli_ava'], ['ecoli_ava'], ['ecoli_ava']],
          drawCurves: false,
          // Strand, not the 'default' red the standalone multi-way figure
          // uses, because strand is what the two halves have in common:
          // LGVSyntenyDisplay colors its lanes by strand already, so an
          // inversion is blue in the lane AND a blue ribbon in the band.
          color: { field: 'strand' },
          minAlignmentLength: 10000,
          collapseEmptyRows: true,
          levelHeights: [levelHeight, levelHeight, levelHeight, levelHeight],
        },
      ],
    },
  )
}

export const syntenySpecs: ScreenshotSpec[] = [
  // The off-screen mate marks, one frame. It was a pair with the marks off and
  // on, and the only difference between the halves was a strip a few pixels
  // tall (review: "unclear what i'm looking at here. just same thing in both
  // multipart panels"), so the callout names the strip instead.
  {
    mode: 'url',
    name: 'synteny_offscreen_mates',
    url: peachGrapeChr1({ marks: true }),
    viewportWidth: 1400,
    // sized off the run's own blank-below-the-content report
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

  // Human vs chimp synteny (hosted liftOver chain, zoomed to an RB1 intron with
  // a human-specific L1HS insertion). 'full' cigarMode paints the indel as a
  // colored wedge. Also guards the oversized-block viewport clip — a
  // chromosome-scale block must render at high zoom instead of a blank canvas.
  {
    mode: 'url',
    name: 'synteny_human_chimp_cigar_modes',
    url: hg38ChimpSynteny('full'),
    viewportWidth: 1200,
    // sized off the run's own blank-below-the-content report after the repeat
    // lanes went compact
    viewportHeight: 691,
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 60000,
  },
  // synteny_te_vapb_sva was here and is DELETED (review: "not very interesting,
  // delete"). It was a third drawing of one claim: an SVA_F in a VAPB intron,
  // which is the same picture as the L1HS in RB1 above at a similar size and
  // with the same reading. What the set is actually for is the SIZE range, and
  // two figures carry that -- ~6 kb above and ~0.3 kb below. The middle one had
  // nothing to add. VAPB_SVA_LOCUS goes with it.
  //
  // Human-specific-TE example two of two: a small AluYb8 insertion in PICALM.
  // PICALM has many RefSeq isoforms — superCompact keeps the gene lanes from
  // dwarfing the ~0.3 kb insertion.
  {
    mode: 'url',
    name: 'synteny_te_picalm_alu',
    url: hg38ChimpSynteny('full', PICALM_ALU_LOCUS),
    viewportWidth: 1200,
    viewportHeight: 667,
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 60000,
  },

  {
    mode: 'url',
    name: 'dotplot',
    // use the full peach_grape.paf (grape_peach_paf), not the small in-repo paf
    // that the config defaultSession loads
    //
    // NO MIN-LENGTH FILTER, and that is the fix for "this looks more sparse
    // than expected to me ... i want the full size paf not the small one"
    // (reviewer). It was already the full PAF; `minAlignmentLength: 2000` was
    // throwing 87% of it away. Measured off the file: 16,192 records, median
    // block 675 bp, p90 2,287 bp, longest 11,450 bp — so a 2 kb floor keeps
    // 2,126 blocks and a 1 kb floor keeps 5,983.
    //
    // The old note here reasoned that since every block is sub-pixel against a
    // 227 x 486 Mbp plot, the filter "is what leaves anything readable". That
    // has it backwards for a dotplot: a sub-pixel block is a DOT, and the
    // structure is the density of dots along a diagonal, so thinning them is
    // thinning the signal. Rendered at 2000, 1000 and 0 and compared: the
    // diagonals across grape chr5/chr9/chr17 and the Pp03 and Pp06 columns are
    // faint streaks at 2000 and continuous runs at 0. The horizontal repeat
    // bands on grape chr12-chr14 are present at every threshold and are
    // proportionally LEAST dominant unfiltered.
    //
    // No `color`. Per-query coloring was added here to separate the survivors,
    // and it does not: a rainbow of one-pixel dots reads as noise with extra
    // steps (reviewer). Black is the house style for a dotplot, and where the
    // plain plot has no structure to show, that is the dataset's problem to fix
    // rather than the palette's.
    url: sessionSpec(DOTPLOT_CONFIG, {
      views: [
        {
          type: 'DotplotView',
          views: [{ assembly: 'peach' }, { assembly: 'grape' }],
          tracks: ['grape_peach_paf'],
          minAlignmentLength: 0,
        },
      ],
    }),
    readySelector: displayPainted('dotplot_webgl_canvas'),
    readyTimeout: 60000,
  },

  {
    mode: 'url',
    name: 'linear_synteny',
    // Whole-genome grape vs peach MCScan synteny as an explicit controlled
    // session (was a reviewer share link whose mismatched per-panel zoom fanned
    // ribbons far off the left edge — the "drawing offscreen" the review
    // flagged). Both panels span their full assemblies at matched scale, so the
    // ribbons stay inside the view. Per-query color plus a higher alpha and a
    // taller synteny band keep the straight ribbons legible.
    url: sessionSpec(DOTPLOT_CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['grape_peach_synteny_mcscan'],
          drawCurves: false,
          color: { field: 'query' },
          // higher alpha + a taller synteny band give the ribbons room to read,
          // and autoDiagonalize reorders the panels into clean diagonals
          // (increase height, add opacity, diagonalize; then opacity
          // bumped a little more). levelHeights (not a `levels` snapshot) is the
          // key the launch init consumes.
          opacity: 0.8,
          levelHeights: [360],
          autoDiagonalize: true,
          views: [{ assembly: 'peach' }, { assembly: 'grape' }],
        },
      ],
    }),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 60000,
  },

  // Multi-way synteny demos: grape_peach_cacao for the multiway_synteny.md
  // (ortholog tables) tutorial, ecoli_pangenome for the allvsall_synteny.md
  // tutorial. Both load a
  // hosted demo config (whose defaultSession opens the stacked LinearSyntenyView)
  // as a bare ?config= against the local build, since MCScanBlocksAdapter /
  // MultiGenomePAFAdapter are newer than jbrowse.org/code/jb2/latest. Generous
  // timeout/settle: the config pulls remote genomes + a synteny file and
  // autoDiagonalize runs a whole-genome RPC before the canvas settles.
  {
    mode: 'url',
    name: 'multiway_synteny/grape_peach_cacao',
    // Rows peach / cacao / grape. One grape_peach_cacao_blocks track (listing
    // all three assemblies) backs both bands — the view tells the adapter which
    // pair each band draws. color: { field: 'reference' } anchors every level on the
    // middle row (cacao, shared by both bands) so a cacao chromosome carries ONE
    // color as it's traced up into peach and down into grape. autoDiagonalize
    // reorders/flips each lower axis to follow the one above.
    //
    // This order is deliberate: diagonalize cascades top-down (each level
    // reorders its lower axis against the row above), and it can only clean a
    // pair with ~1:1 chromosome correspondence. cacao-grape is that pair, so it
    // goes LAST (bottom) where nothing downstream re-scrambles it → a clean
    // diagonal band. The top peach-cacao band is transitive (peach and cacao
    // relate only through the grape MCScan reference) AND cross-karyotype
    // (peach 8 / grape 19 / cacao 10 chr), so it stays busy — but its
    // chromosomes ARE now ordered to minimize crossing (cacao is reordered
    // against peach at level 0). This previously looked un-diagonalized because
    // runDiagonalize fetched without a targetAssemblyName, so the multi-genome
    // MCScanBlocksAdapter defaulted the mate to grape and reordered cacao
    // against the wrong (peach-grape) band — leaving cacao in raw fai order.
    // Mirrors the hosted config's defaultSession init otherwise.
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/grape_peach_cacao/config.json',
      ),
      {
        views: [
          {
            type: 'LinearSyntenyView',
            views: [
              { assembly: 'GCF_000346465.2' },
              { assembly: 'GCF_000208745.1' },
              { assembly: 'GCF_030704535.1' },
            ],
            tracks: [
              ['grape_peach_cacao_blocks'],
              ['grape_peach_cacao_blocks'],
            ],
            color: { field: 'reference' },
            autoDiagonalize: true,
            // the rows hold no track, so uncollapsed each draws a "No tracks
            // active" placeholder over its chromosome ticks
            collapseEmptyRows: true,
          },
        ],
      },
    ),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
    viewportHeight: 433,
  },

  // Gene-level ortholog zoom: drill into a ~75 kb window of the conserved
  // block (grape chr11 / peach chrG7 / cacao chr9). showOnlyGenes collapses each locus
  // to its gene glyph and compact displayMode packs the rows, so the ribbons
  // read one ortholog at a time. All three run in the same (forward)
  // orientation, so no [rev] flips are needed. The fan at the right of the
  // frame is the finding, and the annotation below says why.
  {
    mode: 'url',
    name: 'multiway_synteny/grape_peach_cacao_gene_orthologs',
    viewportHeight: 822,
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/grape_peach_cacao/config.json',
      ),
      {
        views: [
          {
            type: 'LinearSyntenyView',
            views: [
              {
                assembly: 'GCF_000346465.2',
                loc: 'chrG7:18,555,000-18,690,000',
                tracks: [
                  {
                    trackId: 'GCF_000346465.2-ncbiRefSeq',
                    // Named even though it is what the track would open with
                    // anyway: the config is hosted, so the figure-recipe
                    // builder can't look the track up to learn its display,
                    // and without one it can't say where 'compact' is set.
                    type: 'LinearBasicDisplay',
                    showOnlyGenes: true,
                    displayMode: 'compact',
                    // was `showDescriptions: false`, meaning "names suffice
                    // here". That has no home on the unified labels enum, so
                    // migrateBasicConfigSnapshot resolves it to 'auto' —
                    // descriptions do come back at low density. Written as what
                    // it actually resolved to; pinning 'name' would honor the
                    // original intent but change the figure, so that is a call
                    // for whoever regenerates it.
                    showLabels: 'auto',
                  },
                ],
              },
              {
                assembly: 'GCF_030704535.1',
                loc: 'chr11:778,000-905,000',
                tracks: [
                  {
                    trackId: 'GCF_030704535.1-ncbiRefSeq',
                    type: 'LinearBasicDisplay',
                    showOnlyGenes: true,
                    displayMode: 'compact',
                    // as above: the retired `showDescriptions: false` resolved
                    // to 'auto'
                    showLabels: 'auto',
                  },
                ],
              },
              {
                assembly: 'GCF_000208745.1',
                loc: 'chr9:3,890,000-3,995,000',
                tracks: [
                  {
                    trackId: 'GCF_000208745.1-ncbiRefSeq',
                    type: 'LinearBasicDisplay',
                    showOnlyGenes: true,
                    displayMode: 'compact',
                    // as above: the retired `showDescriptions: false` resolved
                    // to 'auto'
                    showLabels: 'auto',
                  },
                ],
              },
            ],
            tracks: [
              ['grape_peach_cacao_blocks'],
              ['grape_peach_cacao_blocks'],
            ],
            drawCurves: true,
            color: { field: 'reference' },
          },
        ],
      },
    ),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
    // THE RIBBONS ARE ACCURATE AND THE "DOUBLING" IS THE FINDING (reviewer: "i
    // think previously this had less 'doubling' of ribbons. please check that
    // the new ribbons are accurate. not sure if it is due to isoforms").
    //
    // Checked against the two files the track reads, not against the picture.
    // `grape.blocks.gz` is keyed on TRANSCRIPT ids (rna-XM_...), so the first
    // guess -- one gene's isoforms each drawing their own ribbon -- is the right
    // shape and the wrong mechanism: over this window `grape.bed.gz` has 15
    // grape transcripts at 15 distinct loci, one row each, no locus repeated.
    // What repeats is the MATE. Of the 12 rows here that have a peach ortholog,
    // three name the same peach transcript (rna-XM_007203660.2) and the same
    // cacao one, from three grape loci 20 kb apart at 836 kb, 857 kb and 862 kb;
    // two more share rna-XM_020568573.1 from 778 kb and 784 kb.
    //
    // Those three grape loci are the trimethyltridecatetraene synthase copies
    // RefSeq names. So the fan is a tandem expansion in grape against a
    // single ortholog in each of the other two genomes -- 3:1 and 2:1 anchors
    // that MCScan is right to emit -- and it is the most interesting thing in
    // the frame rather than a rendering fault. Hence a pill instead of a fix.
    // The windows run on past the array so the pill sits right of the fan it
    // names rather than over it.
    annotations: [
      {
        type: 'text',
        text: 'three grape copies, one peach and one cacao ortholog: a tandem expansion',
        fontSize: 18,
        maxWidth: 300,
        leader: true,
        dx: 90,
        anchor: {
          // the MIDDLE panel of the three-genome stack; without the view path
          // this resolves against the top one (peach), which has no such track
          view: [0, 1],
          trackId: 'GCF_030704535.1-ncbiRefSeq',
          loc: 'chr11:863,000',
          fracY: 0.5,
        },
      },
    ],
  },

  // The last paragraph of multiway_synteny.md, which had no figure: the same
  // .blocks track in a PLAIN LGV. With no second row there is no target
  // assembly, so the adapter serves every pair the table covers at once and the
  // grape row carries its peach and its cacao orthologs together;
  // "Group by... > Mate assembly" splits that into one labelled lane per genome.
  // Baked into the session (facet on the track entry) rather than driven
  // through the menu, so the figure can't drift from it.
  //
  // Same window as the gene-ortholog figure above (grape 11), so the two are the
  // same locus read the two ways: as a stack of three genomes, and as one genome
  // with a lane per mate.
  {
    mode: 'url',
    name: 'multiway_synteny/blocks_one_vs_all',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/grape_peach_cacao/config.json',
      ),
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'GCF_030704535.1',
            loc: 'chr11:778,000-866,000',
            tracks: [
              {
                trackId: 'GCF_030704535.1-ncbiRefSeq',
                type: 'LinearBasicDisplay',
                showOnlyGenes: true,
                displayMode: 'compact',
                // as above: the retired `showDescriptions: false` resolved to
                // 'auto'
                showLabels: 'auto',
              },
              {
                trackId: 'grape_peach_cacao_blocks',
                type: 'LGVSyntenyDisplay',
                facet: 'mateAssembly',
                // an anchor block is short at this zoom, and what the figure is
                // about is which lane has one, so the bars get some thickness
                featureHeight: 14,
                // SIX lanes now, not two (review: "it would be cool if we had
                // even more plants"). At 90 the last of them was cut off by the
                // lane's own bottom edge; 200 left 108 px of empty lane under
                // it, which the run reports.
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

  // The same seven-genome .blocks track as MultiWaySyntenyDisplay: one lane
  // per genome inside a plain LGV, each lane laid out in its own local
  // coordinate frame fitted to the viewport (only the grape anchor lane is at
  // genomic coordinates), with ribbons connecting each ortholog between
  // adjacent lanes. Same grape 11 window as blocks_one_vs_all, so the two
  // figures are the same locus read two ways: anchor-projected lanes there,
  // row-local lanes with correspondence ribbons here.
  //
  // domain pins the lanes by retention (the reading blocks_one_vs_all
  // established: peach/cacao/poplar/citrus keep the block, arabidopsis a few,
  // tomato one gene), so the ribbon chains degrade downward instead of
  // breaking wherever a sparse lane happens to land — a ribbon only connects
  // ADJACENT lanes, so a near-empty lane in the middle would cut the chains of
  // every denser lane below it.
  {
    mode: 'url',
    name: 'multiway_synteny/lgv_track_lanes',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/grape_peach_cacao/config.json',
      ),
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'GCF_030704535.1',
            loc: 'chr11:778,000-866,000',
            tracks: [
              {
                trackId: 'GCF_030704535.1-ncbiRefSeq',
                type: 'LinearBasicDisplay',
                showOnlyGenes: true,
                displayMode: 'compact',
                showLabels: 'auto',
              },
              {
                trackId: 'grape_peach_cacao_blocks',
                type: 'MultiWaySyntenyDisplay',
                rows: {
                  domain: [
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
    // phase ready covers both fetches: the display folds its dependent
    // per-lane gene-model fetch into displayPhase, so the generic gates and
    // this selector cannot land between the ortholog table and the gene
    // models that fill the lanes
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 120000,
    viewportHeight: 680,
  },

  // Same lanes, same domain, with ribbonColor added: relative strand between
  // the two lanes each ribbon joins, which needs no attribute beyond what
  // every synteny block already carries. Demonstrates `domain` (order) and
  // `ribbonColor` (a colour channel) together, which the config docs describe
  // separately but no figure had shown combined.
  {
    mode: 'url',
    name: 'multiway_synteny/lgv_track_lanes_colored',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/grape_peach_cacao/config.json',
      ),
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'GCF_030704535.1',
            loc: 'chr11:778,000-866,000',
            tracks: [
              {
                trackId: 'GCF_030704535.1-ncbiRefSeq',
                type: 'LinearBasicDisplay',
                showOnlyGenes: true,
                displayMode: 'compact',
                showLabels: 'auto',
              },
              {
                trackId: 'grape_peach_cacao_blocks',
                type: 'MultiWaySyntenyDisplay',
                rows: {
                  domain: [
                    'GCF_000346465.2',
                    'GCF_000208745.1',
                    'poplar',
                    'citrus',
                    'arabidopsis',
                    'tomato',
                  ],
                },
                ribbonColor: { field: 'strand' },
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

  // The gene-level zoom of the same lanes, with a ribbon clicked: a ~35 kb cut
  // around the tandem expansion the gene_orthologs figure reads, close enough
  // that each ribbon connects one gene to one gene. Clicking a ribbon keeps its
  // ortholog group outlined down the stack and opens the pair's details. The
  // click lands in the grape-peach gutter at a gene the whole stack chains
  // through, and the outline outlives the resize-and-refetch the opening
  // widget causes, which is what lets one frame show both.
  {
    mode: 'url',
    name: 'multiway_synteny/lgv_track_clicked',
    url: LGV_TRACK_ZOOM_SESSION,
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 120000,
    viewportHeight: 680,
    hideTooltip: true,
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
      { type: 'waitForAppSettled' },
      { type: 'delay', ms: 2000 },
    ],
  },

  // The CFH cluster from the HPRC page's haplotypes launch, for
  // pangenome_hprc_haplotypes's first section: the page's own panel for the locus,
  // one lane per structural configuration, read from HPRC's release 2.1
  // gbz-base database and our companion index at capture time.
  {
    mode: 'url',
    name: 'pangenome/hprc_gbz_cfhr_lanes',
    url: portalHaplotypeLanes(PORTAL_LOCI.cfhr),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 240000,
    viewportHeight: 560,
  },

  // The E. coli all-vs-all PAF as lanes over the paa-operon island (depth 2,
  // 1,446-1,474 kb) with a depth-5 flank on each side, under the pggb
  // graph-depth wiggle. Each lane colors its own GFF's island genes (feaR,
  // feaB, tynA, paaZ-paaY) red by name, so presence is red in a lane and
  // absence is none: CFT073, Sakai and IAI39 annotate none of them. The name
  // test is the colour's `field`, so the key names the two classes.
  {
    mode: 'url',
    name: 'multiway_synteny/ecoli_island_lanes',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/ecoli_pangenome/config.json',
      ),
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'K12',
            loc: 'chr:1,436,000-1,484,000',
            // The anchor lane is the only lane the view's own gridlines are
            // true at, so with them on the top lane reads as ruled and the four
            // below as not (review: "i can see gridlines near the top row of
            // the multiwaysyntenydisplay, but not on the rest"). Each lane's own
            // ticks stay.
            showGridlines: false,
            tracks: [
              // 120, not 60: the drop is from five genomes to two on a 0-5
              // axis, which at 60 px is a 24 px step read as a hairline
              { trackId: 'ecoli_pggb_depth', height: 120 },
              {
                trackId: 'ecoli_ava',
                type: 'MultiWaySyntenyDisplay',
                rows: { domain: ['NCTC86', 'CFT073', 'Sakai', 'IAI39'] },
                height: 340,
                color: {
                  field:
                    "jexl:feature.name && (startsWith(feature.name,'paa') || startsWith(feature.name,'fea') || feature.name == 'tynA') ? 'island' : 'other'",
                  domain: ['island', 'other'],
                  range: ['#d62728', 'goldenrod'],
                  labels: ['feaR, tynA, paa operon', 'other genes'],
                  title: 'K-12 island genes',
                },
              },
            ],
          },
        ],
      },
    ),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 120000,
    viewportHeight: 712,
  },

  // The deep-time case: the human HOXD cluster over four vertebrate lanes
  // from the OrthoFinder orthogroups table — the same five-genome track the
  // stacked orthofinder_synteny/vertebrates figure draws, read as lanes. Each
  // lane's header names the chromosome the cluster sits on in that genome and
  // [rev] where it is inverted, and every lane draws its own gene models.
  {
    mode: 'url',
    name: 'multiway_synteny/vertebrate_hox_lanes',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/orthofinder_vertebrates/config.json',
      ),
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'human',
            loc: '2:176,090,000-176,290,000',
            tracks: [
              {
                trackId: 'human_genes',
                type: 'LinearBasicDisplay',
                showOnlyGenes: true,
                displayMode: 'compact',
              },
              {
                trackId: 'vertebrates_orthogroups',
                type: 'MultiWaySyntenyDisplay',
                rows: { domain: ['chicken', 'frog', 'gar', 'zebrafish'] },
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

  // The plant case where the lanes' own scales are the finding: five
  // nightshade-family genomes over a tomato window on SL4.0ch04. Pepper's
  // genome is nearly four times tomato's with about the same gene count, so
  // the same two dozen orthologs take 2.8x the DNA there, and the pepper lane
  // says so in the multiple its header carries. Coffee, the outgroup and the
  // smallest genome here, comes back at the anchor's own scale.
  {
    mode: 'url',
    name: 'multiway_synteny/solanaceae_lanes',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/orthofinder_solanaceae/config.json',
      ),
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'tomato',
            loc: 'SL4.0ch04:62,880,000-63,037,000',
            tracks: [
              {
                trackId: 'tomato_genes',
                type: 'LinearBasicDisplay',
                showOnlyGenes: true,
                displayMode: 'compact',
                // Ensembl's tomato GFF3 names every gene `gene:gene-Solyc04g…`,
                // so the labels are three lines of identifier that say nothing
                // the glyphs do not. The fly figure above keeps its labels for
                // the opposite reason: those are symbols.
                showLabels: 'none',
              },
              {
                trackId: 'solanaceae_orthogroups',
                type: 'MultiWaySyntenyDisplay',
                rows: { domain: ['potato', 'pepper', 'tobacco', 'coffee'] },
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

  // The animal case at the other end of the divergence scale: five fly genomes
  // on one orthogroups track, anchored on a melanogaster 3L window whose 20
  // genes every one of the four other flies keeps. What the lanes add over the
  // stacked figure is per-lane framing: simulans and yakuba draw the block at
  // the anchor's own scale and in its order, while pseudoobscura and virilis
  // draw the same genes [rev] — the block survived, its orientation did not.
  // The pseudoobscura lane names the X, because Muller element D (melanogaster
  // 3L) is fused to the X in the obscura lineage, and a lane header naming a
  // different chromosome than the anchor is exactly how that reads.
  {
    mode: 'url',
    name: 'multiway_synteny/drosophila_lanes',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/orthofinder_drosophila/config.json',
      ),
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'melanogaster',
            loc: '3L:5,789,000-5,931,000',
            tracks: [
              {
                trackId: 'melanogaster_genes',
                type: 'LinearBasicDisplay',
                showOnlyGenes: true,
                displayMode: 'compact',
              },
              {
                trackId: 'drosophila_orthogroups',
                type: 'MultiWaySyntenyDisplay',
                rows: {
                  domain: ['simulans', 'yakuba', 'pseudoobscura', 'virilis'],
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

  // Eight primates on a gene-symbol join, no aligner: the TP53 neighbourhood
  // over seven lanes, each drawing its own RefSeq gene models. Strand color so
  // the one lane reading the block reversed (siamang) is painted as an
  // inversion while its mirroring draws it straight — the negative is that one
  // lane, and the color is what carries it.
  {
    mode: 'url',
    name: 'multiway_synteny/primate_tp53_lanes',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/primate_orthologs/config.json',
      ),
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'hg38',
            loc: 'chr17:7,400,000-7,700,000',
            tracks: [
              {
                trackId: 'primate_orthologs',
                type: 'MultiWaySyntenyDisplay',
                ribbonColor: { field: 'strand' },
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
    hideTooltip: true,
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

  // Four megabases of chr17 where the strand color separates two things a
  // wider window mixes: the three African ape lanes read the whole frame
  // backwards, and inside it one block flips in the orangutan and macaque
  // lanes while their own flanks stay forward. Every lane spans about the
  // window, so the bundles run level and the color is what carries.
  {
    mode: 'url',
    name: 'multiway_synteny/primate_chr17_inversions',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/primate_orthologs/config.json',
      ),
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'hg38',
            loc: 'chr17:34,000,000-38,000,000',
            tracks: [
              {
                trackId: 'primate_orthologs',
                type: 'MultiWaySyntenyDisplay',
                ribbonColor: { field: 'strand' },
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

  // Human chr2 over the two chimpanzee chromosomes carrying its halves, from
  // the gene-symbol track in a linear synteny view. A lane follows one contig,
  // so the lane display cannot draw both halves at the fusion; two rows can.
  // 'target' colors each ribbon by its chimpanzee chromosome, and
  // autoDiagonalize flips hsa2a, which the assembly deposits opposite to 2p.
  {
    mode: 'url',
    name: 'multiway_synteny/primate_chr2_fusion',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/primate_orthologs/config.json',
      ),
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
            color: { field: 'target' },
            autoDiagonalize: true,
            levelHeights: [300],
            opacity: 1,
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

  // The same join at cohort scale: 44 E. coli and Shigella genomes under K-12
  // at the atp operon, every lane carrying its own PGAP gene models and every
  // gene one color down the stack. Densest-first puts the reduced Shigella
  // genomes at the bottom; the [rev] lanes are chromosomes deposited the
  // other way round.
  {
    mode: 'url',
    name: 'multiway_synteny/ecoli_symbol_atp_operon',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/ecoli_orthologs/config.json',
      ),
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'MG1655',
            loc: 'NC_000913.3:3,910,000-3,925,000',
            tracks: [
              {
                trackId: 'ecoli_orthologs',
                type: 'MultiWaySyntenyDisplay',
                height: 1500,
              },
            ],
          },
        ],
      },
    ),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 240000,
    viewportHeight: 1740,
  },

  // The join's negative at cohort scale: the O-antigen cluster between galF
  // and gnd. The K-12 derivatives sort to the top and match it gene for gene;
  // every lane below chains the flanks, wzx and wzy, and draws its
  // serotype-specific genes grey.
  {
    mode: 'url',
    name: 'multiway_synteny/ecoli_symbol_oantigen',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/ecoli_orthologs/config.json',
      ),
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'MG1655',
            loc: 'NC_000913.3:2,095,000-2,115,000',
            tracks: [
              {
                trackId: 'ecoli_orthologs',
                type: 'MultiWaySyntenyDisplay',
                height: 1500,
              },
            ],
          },
        ],
      },
    ),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 240000,
    viewportHeight: 1740,
  },

  // Whole-genome alignment as lanes, eukaryote scale: hg38 over eight UCSC
  // genomes from the hosted liftOver PIFs, one MultiPairwiseSyntenyAdapter
  // track over eight pairwise files, at the TP53 neighbourhood. Every gutter
  // draws its lane against hg38, since a star of pairwise alignments holds no
  // mate-vs-mate rows.
  {
    mode: 'url',
    name: 'multiway_synteny/hg38_vertebrates_tp53',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/hg38_vertebrates/config.json',
      ),
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'hg38',
            loc: 'chr17:7,400,000-7,700,000',
            tracks: [
              'hg38-ncbiRefSeq',
              {
                trackId: 'hg38_liftover_multiway',
                type: 'MultiWaySyntenyDisplay',
                ribbonColor: { field: 'strand' },
                height: 600,
              },
            ],
          },
        ],
      },
    ),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 240000,
    viewportHeight: 1000,
  },

  // The amylase locus from the HPRC page's haplotypes launch with five lanes
  // chosen, one of each span class, in copy-number order: each lane's length
  // across the array carries its count.
  {
    mode: 'url',
    name: 'multiway_synteny/hprc_amylase_lanes',
    url: portalHaplotypeLanes(PORTAL_LOCI.amylase),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 240000,
    viewportHeight: 620,
  },

  // One haplotype of each common amylase structure, H1a to H7 in the naming of
  // Yilmaz et al. 2024, with GRCh38 and a second three-copy haplotype as the
  // straight-through control, each aligned to the row under it by minimap2
  // (scripts/build_amylase_haplotypes.sh). One to three and three to five each
  // open the same 94 kb insertion wedge.
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
          tracks: [
            ['amylase_adjacent'],
            ['amylase_adjacent'],
            ['amylase_adjacent'],
            ['amylase_adjacent'],
          ],
          color: { field: 'strand' },
          drawCurves: true,
          levelHeights: [110, 110, 110, 110],
        },
      ],
    }),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 240000,
    viewportHeight: 1400,
  },

  // GSTT1, which GRCh38's chr22 lacks, from the haplotypes launch with ten
  // lanes ordered by structure: the ribbon fans open at the first carrier and
  // runs unbroken between the carriers below it.
  {
    mode: 'url',
    name: 'multiway_synteny/hprc_gstt1_lanes',
    url: portalHaplotypeLanes(PORTAL_LOCI.gstt1),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 240000,
    viewportHeight: 960,
  },

  // SyRI's typed regions between two Arabidopsis accessions
  // (scripts/build_syri_synteny.sh), colored by the syri tag in plotsr's
  // palette. The crossed ribbon is the 1.17 Mb Chr4 inversion between Col-0 and
  // Ler, with syntenic regions either side of it as the control.
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
          color: { field: 'syri', domain: SYRI_TYPES },
          drawCurves: true,
          opacity: 0.9,
          fadeThinAlignmentsMode: 'off',
          collapseEmptyRows: true,
          levelHeights: [260],
        },
      ],
    }),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
    viewportHeight: 460,
  },

  // Six accessions, each band the SyRI run between the two genomes it joins,
  // the first four in plotsr's own order. The Chr4 inversion crosses only under
  // Col-0, and a Chr3 inversion only between Kyo and Sha.
  {
    mode: 'url',
    name: 'syri/six_accessions',
    url: sessionSpec(SYRI_CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          views: SYRI_ACCESSIONS.map(assembly => ({ assembly })),
          tracks: SYRI_ACCESSIONS.slice(1).map(() => ['syri_pangenome']),
          color: { field: 'syri', domain: SYRI_TYPES },
          drawCurves: true,
          opacity: 0.9,
          fadeThinAlignmentsMode: 'off',
          collapseEmptyRows: true,
          levelHeights: SYRI_ACCESSIONS.slice(1).map(() => 150),
        },
      ],
    }),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
    viewportHeight: 1040,
  },

  // The same accessions as lanes under Col-0's own coordinates: each lane placed
  // by its SyRI run against Col-0, each band between lanes drawn from the run
  // between those two accessions. The row track above is every accession's
  // regions against Col-0. The inversion is Col-0's own, so every row and the
  // Col-0 band cross while the bands between accessions run straight.
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
              type: 'LinearMultiRowFeatureDisplay',
              height: 110,
            },
            {
              trackId: 'syri_pangenome',
              type: 'MultiWaySyntenyDisplay',
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

  // The 1001 Genomes Plus demo: SyRI's regions of 26 accessions against TAIR10
  // over the chromosome 4 inversion. Col-0's own assembly and KBS-Mac-74 run
  // syntenic across it and every other row is inverted.
  {
    mode: 'url',
    name: 'syri/tair10_1001g',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/arabidopsis_pangenome/config.json',
      ),
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'TAIR10',
            loc: 'Chr4:1-4,000,000',
            tracks: [
              {
                trackId: 'syri_regions_on_TAIR10',
                type: 'LinearMultiRowFeatureDisplay',
                height: 644,
              },
            ],
          },
        ],
      },
    ),
    readyText: 'Tnz-1',
    readySelector: '[data-testid="multirow_canvas"]',
    readyTimeout: 120000,
    viewportHeight: 870,
  },

  // hg38 chr17 near 15.75 Mb, where the mouse, dog and cow alignments change
  // orientation while the primate lanes run straight, under `Color by... →
  // Strand`. A lane drawn flipped runs its ribbons straight on screen while the
  // strand color still marks each of them, and a crossed ribbon into an
  // unflipped lane is one block against its neighbours. The same window in grey
  // (`hg38_vertebrates_17p_break`) was retired: everything it showed, this
  // shows, with the orientation readable.
  {
    mode: 'url',
    name: 'multiway_synteny/hg38_vertebrates_17p_strand',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/hg38_vertebrates/config.json',
      ),
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'hg38',
            loc: 'chr17:15,200,000-16,400,000',
            tracks: [
              'hg38-ncbiRefSeq',
              {
                trackId: 'hg38_liftover_multiway',
                type: 'MultiWaySyntenyDisplay',
                ribbonColor: { field: 'strand' },
                height: 600,
              },
            ],
          },
        ],
      },
    ),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 240000,
    viewportHeight: 1000,
  },

  // The grasses radiation as lanes: the rice window the
  // orthofinder_synteny/grasses_maize_wgd stacked figure reads, over the same
  // five-genome orthogroups track, with a lane per grass carrying its own gene
  // models. The maize lane keeps the better-populated of maize's two WGD
  // copies (chr1) — one refName per lane — and the section carrying this
  // figure hands the reader to the track-menu launch and the stacked figure
  // for the rest.
  {
    mode: 'url',
    name: 'multiway_synteny/grasses_rice_lanes',
    url: GRASSES_RICE_LANES,
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 120000,
    viewportHeight: 660,
  },

  // selection_pressure.md: the one figure here where the COLOUR is the result
  // rather than the decoration. Human against rhesus macaque at the lysozyme
  // locus on chr12, every ribbon an ortholog pair coloured by dN/dS.
  //
  // The locus was chosen on two measurements, not on the picture. It is
  // collinear between the two species, so the ribbons run parallel and a
  // colour difference is the only thing that varies; and LYZ comes out above 1
  // with a dS near the genome-wide median, which is what makes it a measured
  // signal rather than the artefact that fills the top of an unfiltered
  // ranking (there, every leader has a dS an order of magnitude below the
  // median, where the ratio has no denominator worth dividing by).
  //
  // Adaptive evolution of primate lysozyme is one of the oldest results in the
  // field. YEATS4 sits immediately beside it at dN/dS 0, so the figure carries
  // its own control: two neighbours, one at each end of the ramp.
  //
  // alpha at 0.95 rather than the 0.2 default, which is tuned for whole-genome
  // hairballs and washes a dozen ribbons out to nothing.
  //
  // 3 Mb, up from 1.09 (reviewer: "zoom out even more"). The point of the
  // figure is that ONE ribbon is not blue, and that reads better the more blue
  // neighbours are in frame. The rhesus window is the same span scaled by
  // 1.06/1.09 — the ratio the two 1 Mb windows this replaced already had, which
  // is the two assemblies' local length difference — and centred on the same
  // pair of coordinates, so the ribbons stay parallel instead of shearing.
  {
    mode: 'url',
    name: 'selection_pressure/lysozyme',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/primate_selection/config.json',
      ),
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
                    type: 'LinearBasicDisplay',
                    // names only. The blue Ensembl description line under every
                    // gene ("lysozyme [Source:HGNC Symbol;Acc:...]") is a
                    // second row of text per feature and at 3 Mb it is most of
                    // the ink in the panel, none of it the figure's subject
                    // (reviewer: "turn off show descriptions on gene tracks").
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
                    type: 'LinearBasicDisplay',
                    showLabels: 'name',
                    displayMode: 'compact',
                  },
                ],
              },
            ],
            tracks: [['primate_orthologs']],
            color: { field: 'dnds' },
            opacity: 0.95,
            drawCurves: true,
          },
        ],
      },
    ),
    readyTimeout: 300000,
    // 640 left 60 css px of blank under the bottom row, per the run's report
    viewportHeight: 580,
    // WHAT THE COLOUR MEANS, on the drawing (reviewer: "add red text box
    // pointing at the synteny ribbon explaining why this finding is
    // interesting"). It was in the caption only, so the frame's content was a
    // row of blue ribbons with one orange one and nothing saying that the
    // orange one is the result. Worded the way the section words it — LYZ
    // stands apart from its neighbours, which is a hypothesis worth a codon
    // model rather than a demonstration of selection, and a pill that claimed
    // more than that would contradict the page it sits on.
    //
    // Anchored on the human panel's gene track at LYZ (12:69,348,341-69,354,234
    // in GRCh38, Ensembl 116) rather than on a pixel: the arrow drops from the
    // bottom edge of that track into the ribbon band below it, so both follow
    // the window if it moves again.
    annotations: [
      {
        type: 'text',
        text: 'LYZ, the only pair above 1. Every neighbour is blue',
        fontSize: 18,
        maxWidth: 300,
        // to the RIGHT of the ribbon it names, inside the band: a pill centred
        // on LYZ covers the one ribbon the figure is about, and the band's own
        // 95 px is the only horizontal strip on the frame that is neither gene
        // rows nor ruler
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

  // homoeolog_synteny.md: hexaploid oat against itself, coloured by dS. A and D
  // descend from closely related diploids and C from a more distant one, so
  // A-D anchors sit lower on the ramp than A-C and C-D (medians 0.07 against
  // 0.12, off oat.homoeologs.blocks.gz through oat.bed.gz). Pinned 0 to 0.25,
  // about every pair type's 90th percentile, so a cell's colour is a dS rather
  // than a position among the values in view.
  //
  // The anchors are computed, not curated: Compara's oat assembly is neither
  // the newest nor the most contiguous, so DIAMOND self-alignment, jcvi
  // chaining and scripts/kaks_from_pairs.py build them over GCA_951802345.1
  // (cv. Williams), annotated by Ensembl Plants.
  {
    mode: 'url',
    name: 'homoeolog_synteny/oat_ds',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/oat_homoeologs/config.json',
      ),
      {
        views: [
          {
            type: 'DotplotView',
            displayName: 'Oat self-alignment, dS',
            views: [
              { assembly: 'oat', displayedRegionNames: OAT_HOMOEOLOG_GROUPS },
              { assembly: 'oat', displayedRegionNames: OAT_HOMOEOLOG_GROUPS },
            ],
            tracks: ['oat_homoeologs'],
            color: {
              field: 'ds',
              domainMin: 0,
              domainMax: 0.25,
              title: 'dS',
            },
          },
        ],
      },
    ),
    readySelector: displayPainted('dotplot_webgl_canvas'),
    readyTimeout: 300000,
    viewportHeight: 767,
    viewportWidth: 900,
  },

  // orthofinder_synteny.md: human/chicken/frog/spotted gar/zebrafish, stacked
  // on OrthoFinder orthogroups rather than a whole-genome aligner. One
  // vertebrates_orthogroups track (MCScanBlocksAdapter) backs all four bands.
  // The assemblies are ChromSizesAdapter (no sequence, names/lengths only, see
  // the tutorial's "Assemblies without sequence" section) - a tagged
  // jbrowse-web release may not carry the LinearSyntenyView fix that
  // combination needs, so this renders against the site's own build (main)
  // rather than a fixed jbrowse-web version the way the other synteny specs
  // above do.
  {
    mode: 'url',
    name: 'orthofinder_synteny/vertebrates',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/orthofinder_vertebrates/config.json',
      ),
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
            tracks: [
              ['vertebrates_orthogroups'],
              ['vertebrates_orthogroups'],
              ['vertebrates_orthogroups'],
              ['vertebrates_orthogroups'],
            ],
            color: { field: 'reference' },
            // On, and it runs on every level including the last (review: "the
            // last comparison with zebrafish is particularly scrambled, unclear
            // if autodiagonalization is working there"). Checked against a
            // rendered autoDiagonalize:false control: without it the rows sit in
            // their natural order (chicken 1..Z, zebrafish 1..25) and the upper
            // bands lose the vertical bundling they have here, so it is running
            // and it is helping.
            //
            // The bottom band stays dense because the map it is drawing is not
            // one-to-one, which is measurable from the demo's own files rather
            // than a matter of opinion. Weighting each chromosome by its link
            // count, a chromosome's single best partner accounts for 79% of its
            // links chicken to frog, 50% human to chicken, and 33% gar to
            // zebrafish: past the teleost genome duplication, two thirds of
            // every gar linkage group's orthologs land somewhere other than its
            // best zebrafish partner. No left-to-right ordering can make that
            // diagonal, and no filter rescues it either (dropping every
            // multi-copy expansion would still leave ~13k of the band's ~16.9k
            // links). The band is dense because the answer is. Those three
            // shares are computed over distinct gene pairs, which is what the
            // band draws since MCScanBlocksAdapter deduplicates a link the
            // table names on several rows; the row counts are ~5% higher.
            autoDiagonalize: true,
            // and one bp/px down the stack, see the wheat spec below. Row
            // length is genome size here too: human's 3.1 Gb against the
            // 0.9-1.5 Gb of the four below it, with gar and zebrafish (0.90 and
            // 1.35) the pair the bottom band is really about.
            sameScale: true,
            // see the grasses spec below for why these settings; the three
            // OrthoFinder figures are the same picture on different genomes
            collapseEmptyRows: true,
            levelHeights: [180, 180, 180, 180],
            // 0.3, twice what the grasses and wheat figures take (review:
            // "increase opacity"). Alpha is a per-link constant and the picture
            // is what the links pile up into, so the value that reads is set by
            // how collinear the genomes are, not by the figure being one of a
            // set. The grasses are five grass genomes: a rice chromosome's
            // orthologs land almost entirely on one partner, the links arrive as
            // tight bundles and 0.15 saturates them. These five span ~430 My and
            // a teleost genome duplication, so the same 0.15 spread the same
            // number of links over the whole band and every one of them came out
            // as background — the lower bands in particular read as a grey wash
            // with a few strong diagonals on it. At 0.3 a single ortholog is
            // visible and the bundles are solid without flooding their bands.
            opacity: 0.3,
            drawCurves: false,
          },
        ],
      },
    ),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
    viewportHeight: 1000,
    // The one published result this stack is evidence for, named on the band
    // that shows it (reviewer: "add a small number (1-2) red box text
    // annotations to figure showing e.g. known results about the chromosome
    // changes"). Anchored to the `gar` row label, which is DOM text, and pushed
    // down into the left of the band it heads, where no ribbons run.
    //
    // The name alone was two words and the follow-up review is why it now
    // carries a second line: "might need to explain it is teleost duplication,
    // so the result is, the ribbons are all scattered/duplicated between gar
    // and zebrafish". The band's shape IS the result and a reader who does not
    // already know the event cannot get from one to the other -- every other
    // band in the stack is one row's chromosome onto one partner's, and this
    // one is each gar chromosome arriving at two places. That is the sentence
    // the picture cannot say.
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

  // orthofinder_synteny.md: tomato, potato, pepper, Nicotiana attenuata and
  // coffee as the outgroup. sameScale makes the row LENGTHS the point here:
  // the five carry comparable gene counts (25-39k) over 0.38 to 2.9 Gb of
  // sequence, so pepper's row runs nearly four times tomato's while answering
  // it gene for gene. N. attenuata's assembly is the one still on scaffolds,
  // which its band shows and the build's correspondence print measures at 14%.
  {
    mode: 'url',
    name: 'orthofinder_synteny/solanaceae',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/orthofinder_solanaceae/config.json',
      ),
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
            tracks: [
              ['solanaceae_orthogroups'],
              ['solanaceae_orthogroups'],
              ['solanaceae_orthogroups'],
              ['solanaceae_orthogroups'],
            ],
            color: { field: 'reference' },
            autoDiagonalize: true,
            sameScale: true,
            collapseEmptyRows: true,
            levelHeights: [180, 180, 180, 180],
            opacity: 0.2,
            drawCurves: false,
          },
        ],
      },
    ),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
    viewportHeight: 1000,
  },

  // orthofinder_synteny.md: five Drosophila genomes, melanogaster out to
  // virilis at roughly 50 My. Muller's elements are what the stack is for: a
  // melanogaster arm's orthologs stay on ONE chromosome in each of the four
  // rows below, which the build's own correspondence print puts at 98% for the
  // closest pair and 77% for the widest. The gene ORDER inside an element does
  // not survive that, and the lanes figure above is where that half reads.
  //
  // alpha 0.15 rather than the vertebrates figure's 0.3: these five are
  // one-to-one enough that the links arrive as tight bundles, the same reason
  // the grasses figure below takes 0.15.
  //
  // melanogaster repeats between the other four, as the launch dialog's "Repeat
  // anchor between panels" lays a star out, so every band touches it and
  // 'reference' (the assembly bordering the most bands) is melanogaster. In a
  // five-row chain it was simulans, and the bands below yakuba painted by their
  // own upper row.
  {
    mode: 'url',
    name: 'orthofinder_synteny/drosophila',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/orthofinder_drosophila/config.json',
      ),
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
            tracks: [
              ['drosophila_orthogroups'],
              ['drosophila_orthogroups'],
              ['drosophila_orthogroups'],
              ['drosophila_orthogroups'],
              ['drosophila_orthogroups'],
              ['drosophila_orthogroups'],
            ],
            color: { field: 'reference' },
            autoDiagonalize: true,
            diagonalizeAnchorRow: 1,
            sameScale: true,
            collapseEmptyRows: true,
            levelHeights: [150, 150, 150, 150, 150, 150],
            opacity: 0.15,
            drawCurves: false,
          },
        ],
      },
    ),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
    viewportHeight: 1240,
  },

  // orthofinder_synteny.md: rice/sorghum/maize/brachypodium/foxtail millet.
  // Maize's whole-genome duplication is the thing to see: a maize gene's
  // orthogroup commonly holds two maize copies, so the .blocks conversion's
  // --pick expand default draws both rather than picking one arbitrarily,
  // and the maize bands carry visibly more ribbons per rice/sorghum gene than
  // the non-duplicated pairs do.
  {
    mode: 'url',
    name: 'orthofinder_synteny/grasses',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/orthofinder_grasses/config.json',
      ),
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
            tracks: [
              ['grasses_orthogroups'],
              ['grasses_orthogroups'],
              ['grasses_orthogroups'],
              ['grasses_orthogroups'],
            ],
            color: { field: 'reference' },
            autoDiagonalize: true,
            // One bp/px down the stack, see the wheat spec below. This set has
            // the widest size spread of the three (brachypodium 0.27 Gb to
            // maize 2.14 Gb), so it is also where the shared scale costs the
            // most frame: the four small rows are drawn between an eighth and a
            // third of maize's length.
            sameScale: true,
            // No row carries a track, so every row was spending ~90px on a "No
            // tracks active / Open track selector" block: five of them, down the
            // middle of the frame, over half the height the ribbons had.
            collapseEmptyRows: true,
            // and the reclaimed height goes to the bands. A ribbon here is one
            // gene pair, so a band's legibility is entirely how far apart its
            // crossings are drawn.
            levelHeights: [180, 180, 180, 180],
            // Under the 0.2 default, which is tuned for alignment ribbons with
            // area; an orthogroup link is a hairline at whole-genome zoom, and
            // tens of thousands of them at 0.2 saturate into one wash where a
            // dense chromosome-to-chromosome bundle and a lone scattered
            // ortholog paint the same. Lower, only overlap accumulates color,
            // so the bundles are the visible thing and the singletons stay
            // background. These grass chromosomes are near one-to-one, so the
            // links arrive as tight bundles and this is as high as it can go;
            // the vertebrates figure takes twice it, for the opposite reason.
            opacity: 0.15,
            // Straight chords, though this is the one case the drawCurves
            // docstring recommends itself for. Rendered both: the bezier version
            // is by far the prettier picture and the worse figure, because a
            // curve leaves its chromosome vertically and only bends toward its
            // partner in the middle of the band, so the bundles braid together
            // where they cross and stop pointing at anything. Which chromosome
            // maps to which is the whole content here, and a straight chord is
            // the line that says it.
            drawCurves: false,
          },
        ],
      },
    ),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
    // five collapsed scalebar rows and four 180px bands
    viewportHeight: 1000,
  },

  // orthofinder_synteny.md: the --pick expand decision at gene resolution,
  // which the whole-genome grasses figure above can only show as density.
  // Sorghum on top is the control - it did not have maize's whole-genome
  // duplication - so the top band is one ribbon per gene and the bottom is two.
  //
  // The window was picked by measurement, and every number below is printed by
  // `scripts/orthofinder_window_stats.py` from the demo's own files, so it can
  // be re-derived rather than believed. Run it with this spec's own loc
  // strings, which is what it takes:
  //
  //   python3 scripts/orthofinder_window_stats.py grasses \
  //     --row 'sorghum 1:5,934,000-6,126,000[rev]' \
  //     --row 'rice 3:31,590,000-31,775,000' \
  //     --row 'maize 1:286,676,000-287,665,000 5:6,261,000-6,790,000[rev]' \
  //     --query rice
  //
  // The counts are what the three drawn windows contain rather than what the
  // blocks file holds anywhere - a partner outside the window its row displays
  // is not a ribbon. Of
  // the 27 rice genes in the frame, 12 have exactly two maize ribbons and every
  // one of those pairs lands one copy on maize 1 and the other on maize 5; one
  // has three (a tandem pair on maize 1 plus the maize 5 copy); 5 have a single
  // maize ortholog, four keeping the chr1 copy and one the chr5 copy, which is
  // fractionation; 9 draw none. Sorghum answers exactly once for 19 of them and
  // not at all for 8. One gene (Os03g0765400) has its only maize and sorghum
  // orthologs on other chromosomes entirely, so it is a blank in both bands.
  // The genes that draw nothing leave gaps in the fan and are kept: trimming
  // the window until it was solid would be picking the frame to flatter the
  // result.
  //
  // Maize spans two regions because that is the finding. Each row is framed to
  // its own copy of the block plus ~4%, and the copies are not the same length:
  // 170 kb of rice, 178 kb of sorghum, 950 kb on maize 1 and 489 kb on maize 5.
  // So the maize row is drawn at ~8x rice's bp/px and every ribbon in the lower
  // band is a wedge, wide at the rice end and narrow at the maize end. That
  // ratio is the block lengths and nothing else - maize's genome is ~5x rice's
  // and its syntenic blocks are stretched to match, and each row's span is
  // stated in the header above it. Both ways out are worse, and both
  // were rendered: sameScale puts the stack on maize's scale and leaves rice
  // and sorghum a sliver at the left edge, while widening rice to close the gap
  // (tried at 290 kb and 410 kb) does flatten the wedges but fills the top band
  // with ribbons from genes the maize windows do not reach, so the two bands
  // stop counting the same genes - which is the entire comparison.
  //
  {
    mode: 'url',
    name: 'orthofinder_synteny/grasses_maize_wgd',
    viewportHeight: 1200,
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/orthofinder_grasses/config.json',
      ),
      {
        views: [
          {
            type: 'LinearSyntenyView',
            views: [
              {
                // [rev], and so is maize 5 below. Measured over the demo's own
                // files against rice's ascent, the blocks correlate -0.995
                // (sorghum), +0.981 (maize 1) and -0.943 (maize 5): all three
                // are near-perfectly collinear and two of them run backwards.
                // Unflipped, each inverted one draws as an hourglass through a
                // single crossing point, and two hourglasses read as chaos
                // rather than as one ribbon against two. The orientations are
                // incidental to a figure about COUNT, they stay visible in the
                // rulers, which count down on a reversed region - unlike the
                // wheat 4A figures, where the order along the chromosome IS the
                // finding and nothing is flipped.
                assembly: 'sorghum',
                loc: '1:5,934,000-6,126,000[rev]',
                tracks: [
                  {
                    trackId: 'sorghum_genes',
                    type: 'LinearBasicDisplay',
                    showOnlyGenes: true,
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
                    type: 'LinearBasicDisplay',
                    showOnlyGenes: true,
                    displayMode: 'compact',
                    showLabels: 'none',
                    height: 40,
                  },
                ],
              },
              {
                // the two copies, side by side on one row, chr5 reversed for
                // the reason given on the sorghum row
                assembly: 'maize',
                loc: '1:286,676,000-287,665,000 5:6,261,000-6,790,000[rev]',
                tracks: [
                  {
                    trackId: 'maize_genes',
                    type: 'LinearBasicDisplay',
                    showOnlyGenes: true,
                    displayMode: 'compact',
                    showLabels: 'none',
                    height: 40,
                  },
                ],
              },
            ],
            tracks: [['grasses_orthogroups'], ['grasses_orthogroups']],
            // by the row BELOW each band (field 'query' paints views[level],
            // 'target' views[level+1]). That is what splits the bottom band into
            // two colors, one per maize chromosome, while the top band stays one
            // - the single-vs-double reading, in color as well as in count.
            // 'reference', which the three whole-genome figures use, degenerates
            // here: every row is one or two chromosomes.
            color: { field: 'target' },
            // straight chords, for the reason the whole-genome grasses figure
            // gives: a curve leaves its row vertically and only bends toward its
            // partner mid-band, so where two fans overlap they braid instead of
            // pointing anywhere. Rendered both, and re-rendered once the alpha
            // below came down, since transparency is what would have rescued
            // the curved version: it does not - the curves still bunch into a
            // knot where the two fans meet on maize 5's side. Straight costs
            // nothing on the top band, which is parallel either way, and is what
            // makes the bottom one readable as two fans rather than one tangle.
            drawCurves: false,
            // Under 1, which is what this had when it was two near-solid fans.
            // The reasoning for full strength was about density and is right as
            // far as it goes - ~50 ribbons never accumulate the way the
            // whole-genome figure's ~30k do, so nothing here needs holding back
            // - but the lower band's ribbons CROSS, and at alpha 1 a crossing is
            // just whichever ribbon painted last, so the band read as collision
            // rather than as one fan over another. At 0.65 a crossing shows both
            // ribbons through each other and a lone one is still solid color;
            // 0.35 was also rendered and washes the top band out.
            opacity: 0.65,
            // The lower band takes most of the height, because it is the one
            // with crossings and they are unavoidable: one rice interval into
            // two maize regions drawn side by side means every blue/purple pair
            // whose left-to-right order differs at the two ends has to swap
            // somewhere, and no choice of region order or orientation removes
            // them - only vertical room does. Same argument the whole-genome
            // grasses spec makes for its bands. The top band is parallel and
            // needs none of it.
            levelHeights: [190, 500],
          },
        ],
      },
    ),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
  },

  // orthofinder_synteny.md: wheat's own polyploidy/domestication history, not
  // an abstract duplication. Stack order is the evolutionary chain: Aegilops
  // tauschii (diploid D-genome donor) - bread wheat (hexaploid ABD) - durum
  // (domesticated tetraploid AB) - wild emmer (durum's wild tetraploid
  // ancestor) - Triticum urartu (diploid A-genome donor) - T. timopheevii (a
  // second, independent AG tetraploid that also traces to the A-genome donor).
  // Every adjacent band is therefore a real step rather than an arbitrary
  // pairing. Six rows (one more than the other two sets here), hence the taller
  // viewport.
  {
    mode: 'url',
    name: 'orthofinder_synteny/wheat',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/orthofinder_wheat/config.json',
      ),
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
            tracks: [
              ['wheat_orthogroups'],
              ['wheat_orthogroups'],
              ['wheat_orthogroups'],
              ['wheat_orthogroups'],
              ['wheat_orthogroups'],
            ],
            color: { field: 'reference' },
            autoDiagonalize: true,
            // One bp/px down the whole stack instead of fitting each row to the
            // pane. This set is the case for it: the rows run 4.2 Gb (diploid
            // tauschii) to 14.5 Gb (hexaploid bread wheat), so fit-to-width drew
            // them all the same length and stretched tauschii's 7 chromosomes
            // across the same span as wheat's 21 — which both hides the
            // polyploidy the figure is about and puts every ribbon between those
            // two rows at a 3x horizontal ratio, fanning what is really a clean
            // 1:1 D-genome correspondence. Same scale, the row lengths ARE the
            // genome sizes and a D chromosome sits over its own copy.
            sameScale: true,
            // see the grasses spec above for why these four settings; the three
            // OrthoFinder figures are the same picture on different genomes
            collapseEmptyRows: true,
            levelHeights: [170, 170, 170, 170, 170],
            opacity: 0.15,
            drawCurves: false,
          },
        ],
      },
    ),
    readySelector: displayPainted('synteny_canvas'),
    // The heaviest figure in the set, and the only one of the three OrthoFinder
    // specs that does not finish in 120s on a CI runner — it was the sole
    // synteny failure on the first sweeps of .github/workflows/figures.yml,
    // while grasses and vertebrates passed at the same 120000. The five bands
    // hold 269,656 distinct gene links out of a 106,156-row orthogroup table
    // (327,824 rows before MCScanBlocksAdapter drops the ones the expansion
    // repeated), drawn from both sides, and a GitHub runner has no GPU to draw
    // them with. The wait itself is declarative
    // (`synteny_canvas_done`), so this only raises the ceiling; it does not
    // sleep, and a render that never completes still fails, just later.
    readyTimeout: 300000,
    // six collapsed scalebar rows and five 170px bands. 1120 cut the bottom
    // row's scalebar in half, which is the row that names timopheevii's
    // sequences; 1165 cleared it but left a dead strip under the frame.
    viewportHeight: 1140,
    // The textbook result this stack is a picture of, three words a row
    // (reviewer: "add a small number (1-2) red box text annotations ... showing
    // e.g. known results about the chromosome changes"). Bread wheat is
    // hexaploid A+B+D, and the two diploids in the stack are the donors of two
    // of those subgenomes -- which is exactly what the ribbons show, each
    // donor's seven chromosomes fanning onto the wheat chromosomes carrying its
    // subgenome letter.
    //
    // EACH PILL NOW SITS ON ITS ROW AND THE ROW IS RINGED (review: "the text
    // boxes are interesting but hard to see exactly what it is referring to.
    // might need to circle what it is saying"). Both were dropped 60px into the
    // margin below their row label, which put them in the BAND under the row
    // rather than on it -- and a band is a pair of genomes, so "A genome donor"
    // read as naming urartu-to-timopheevii, which is not what it says. On the
    // row's own line, with a box round the label, the pill names one genome.
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

  // orthofinder_synteny.md: the 4A translocations, out of the same wheat demo
  // and the same one orthogroup track as the six-row figure above. Two rows:
  // all seven Aegilops tauschii chromosomes over bread wheat 4A alone. The
  // whole D genome is on the top row on purpose - the content is that only
  // three of its seven chromosomes reach 4A at all, which a row pre-filtered to
  // those three would assert rather than show.
  //
  // VERIFIED against the demo's own files, since the caption carries the whole
  // finding, and re-derivable in one command:
  //
  //   python3 scripts/orthofinder_window_stats.py wheat \
  //     --row 'tauschii 1D 2D 3D 4D 5D 6D 7D' --row 'wheat 4A' --query wheat
  //
  // Per donor chromosome, where its links land ALONG 4A - which is the axis the
  // finding is about, and not the same as the donor-side extents printed beside
  // them, which are near-whole-chromosome for all seven and separate nothing:
  //   4D  1997 ribbons (2045 rows)   5th-95th pct     9.9 Mb - 601.3 Mb
  //   5D   275 ribbons  (295 rows)   5th-95th pct   604.1 Mb - 641.4 Mb
  //   7D   368 ribbons  (407 rows)   5th-95th pct   648.9 Mb - 742.4 Mb
  // -- three consecutive, non-overlapping blocks in that order, with every other
  // tauschii sequence contributing 30 rows or fewer over the whole chromosome
  // (2D 30, 3D 25, 1D 19, 6D 18) and spreading them over nearly all of 4A rather
  // than over any interval. That is the "scattered singletons" the prose claims,
  // measured, and the spread is the half that makes them scattered rather than
  // merely few.
  //
  // Two counts because they answer different questions and the gap between them
  // is real: `--pick expand` names one gene pair on several rows and the adapter
  // draws it once, so the ribbon count is what the frame holds and the row count
  // is what a join over the table returns. This comment carried only the row
  // counts before, unlabelled.
  //
  // NO ON-FIGURE LABELS NAMING THE THREE BLOCKS, and it is not for want of
  // trying. A synteny view's sub-panels have no `view-container-<id>` element --
  // only top-level views get one (ViewContainer.tsx) -- so a `{view: [0,1],
  // locus}` anchor resolves to nothing and the run says so. The fallback, an
  // in-app `highlight` on the bottom row, draws into the row's tracks area, and
  // this row is a bare scalebar with no tracks, so it has nowhere to paint
  // either. Both were rendered before being removed. Labelling this row needs
  // either a track on it (there is no useful one at 745 Mb) or a locus anchor
  // that works on a sub-panel. The caption does the naming instead, and it says
  // the MIDDLE bundle leaves the RIGHT-HAND END of 5D -- the one real
  // misreading risk here, since that apex sits a few px from the 6D tick label
  // and 6D contributes 18 links to the whole chromosome. Middle rather than a
  // colour word: field 'query' indexes the palette by the assembly's region
  // order, so the 2026-08-28 chrom.sizes rebuild repainted all three bundles
  // without moving any of them.
  {
    mode: 'url',
    name: 'orthofinder_synteny/wheat_4a',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/orthofinder_wheat/config.json',
      ),
      {
        views: [
          {
            type: 'LinearSyntenyView',
            views: [
              // The whole assembly, which this row could not take until the
              // 2026-08-28 rebuild: the demo's chrom.sizes was written
              // largest-first, so the region order was 2D 7D 3D 5D 4D 1D 6D
              // and the row interleaved the three donor chromosomes among the
              // four that draw nothing, the 7D and 5D bundles crossing the 4D
              // one. build_orthofinder_synteny.sh writes chrom.sizes in the
              // GFF3's order now, so 1D..7D lead and the 23 unplaced scaffolds
              // that follow them are 0.46% of the row.
              { assembly: 'tauschii' },
              { assembly: 'wheat', loc: '4A' },
            ],
            tracks: [['wheat_orthogroups']],
            // by the TOP row's chromosome (field 'query' paints views[level],
            // 'target' views[level+1]), so each donor chromosome carries its own
            // color down into 4A. 'reference' - what the other three OrthoFinder
            // figures use to keep a chromosome one color across several bands -
            // degenerates here: one band, and every link lands on the same
            // single bottom-row chromosome, so it paints the figure one color.
            color: { field: 'query' },
            // off. The three segments are the figure, and their order along 4A
            // is a fact about 4A; reordering and flipping the top row to
            // straighten the ribbons would rewrite the thing being shown.
            autoDiagonalize: false,
            // and no sameScale either: 4A is one chromosome against a 4.2 Gb
            // genome, so a shared bp/px draws it as a sixth of the frame. Each
            // row fitted to the pane puts 4A across the full width, which is
            // what separates its three segments.
            collapseEmptyRows: true,
            levelHeights: [430],
            // 0.5, well over the 0.15 the whole-genome wheat figure takes. That
            // one is drawing every D-genome link against every A/B/D partner;
            // this is one chromosome's worth, a twentieth as many ribbons over
            // a taller band, and at 0.15 the two translocated bundles read as
            // smoke beside the native one.
            opacity: 0.5,
            drawCurves: false,
          },
        ],
      },
    ),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
    // two collapsed scalebar rows and one 430px band
    viewportHeight: 640,
    // NAMING THE TWO BLOCKS ON THE FIGURE (reviewer: "add red box text
    // annotations to figure showing that this is e.g. a known result about the
    // chromosome changes"). Both are published: Devos et al. 1995 RFLP-mapped
    // them and Dvorak et al. 2018 reassessed them against the reference
    // assemblies, and the tutorial's reference list carries both dois.
    //
    // Anchored to the TOP ROW'S CHROMOSOME LABELS by testid, since a bare
    // `text: '5D'` matched the smaller "5D" tick labels under 1D and parked
    // both pills off the left edge. The two anchors this figure would
    // otherwise want are both unavailable and the
    // comment above records why: a synteny sub-panel has no
    // `view-container-<id>` element for a `{view, locus}` anchor to resolve
    // against, and an in-app `highlight` has nowhere to paint on a bare
    // scalebar row with no tracks. The tick label is the one element in the
    // frame that names a donor chromosome, and each pill sits under the tick of
    // the chromosome whose bundle it is about.
    //
    // Two words each. The reader needs the block NAMED on the picture; who
    // published it and when is the caption's job, and the tutorial's reference
    // list already carries both dois.
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
    // the default colour, not `{ field: 'query' }`: these are single-chromosome strains, so
    // per-query-name coloring paints everything one near-uniform color and adds
    // no signal (query-name coloring is only useful with multiple
    // chromosomes). Default red ribbons read cleaner here.
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/ecoli_pangenome/config.json',
      ),
      {
        // the minimap2 aligner's version of the stack the pggb and cactus
        // figures draw; see ecoliAvaStack for the row order and every prop
        views: [ecoliAvaStack('ecoli_ava')],
      },
    ),
    viewportHeight: ECOLI_AVA_STACK_HEIGHT,
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
  },

  // The "Add gene tracks" payoff for allvsall_synteny.md: what a ribbon gap
  // actually contains. Two rows (K12 over Sakai) at the Sp5 prophage that
  // carries stx2A/stx2B (Sakai chr:1,267,107-1,268,347).
  //
  // The loci are not a free choice — they are read off the PAF. One 35 kb block
  // (Sakai 1,210,882-1,246,166 <-> K12 1,031,619-1,067,671, 1:1) is the shared
  // backbone; it ends at Sakai 1,246,166 and nothing from Sakai 1,252,260 to
  // 1,274,685 aligns to K-12 at all. The stx2 genes sit in that bare stretch,
  // beyond the backbone block, with no ribbon above them. (The island's own far
  // flanks align to K12 ~566 kb, a different locus — the prophage inserted into
  // a rearranged site — which is why this frames the backbone block, not the
  // flanks.)
  //
  // Both windows are the same 70 kb span so the two rows render at the same
  // bp/px — the "Square view" state the reviewer asked for (both LGVs use the
  // full view width, so equal spans give equal zoom). The backbone block is
  // aligned to the same relative x in each (K12 1,026,000-1,096,000 vs Sakai
  // 1,205,000-1,275,000), so its ribbon runs roughly horizontal and the stx2
  // island bulges into the bare right side of the Sakai row.
  //
  // showOnlyGenes drops the CDS lanes and the full-width `region` feature that
  // RefSeq GFFs carry for the whole chromosome. No minAlignmentLength: at this
  // zoom the short alignments are signal, not noise.
  {
    mode: 'url',
    name: 'multiway_synteny/ecoli_stx_island',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/ecoli_pangenome/config.json',
      ),
      {
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
                    type: 'LinearBasicDisplay',
                    showOnlyGenes: true,
                    displayMode: 'compact',
                    // as above: the retired `showDescriptions: false` resolved
                    // to 'auto'
                    showLabels: 'auto',
                  },
                ],
              },
              {
                // Both rows extend the same 30 kb further right (still 100 kb, so
                // same bp/px and the backbone ribbon stays horizontal): pulls the
                // stx2 island in from the cluttered right edge toward mid-view.
                assembly: 'Sakai',
                loc: 'chr:1,205,000-1,305,000',
                tracks: [
                  {
                    trackId: 'Sakai_genes',
                    type: 'LinearBasicDisplay',
                    showOnlyGenes: true,
                    displayMode: 'compact',
                    // as above: the retired `showDescriptions: false` resolved
                    // to 'auto'
                    showLabels: 'auto',
                  },
                ],
              },
            ],
            tracks: [['ecoli_ava']],
            drawCurves: true,
          },
        ],
      },
    ),
    viewportHeight: 560,
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
    // Point out the stx2 island (the reviewer's ask). The box and arrow ANCHOR
    // to the stx2B gene's own label text, so they track the actual gene at
    // capture time instead of hand-tuned pixels landing on a neighbor.
    annotations: [
      {
        // right-aligned against the right edge (reviewer's ask). stx2B sits at
        // about two thirds across, so the callout is on the far side of what it
        // names and the arrow now runs right-to-left; `textAlign: 'end'` is what
        // pins the pill's RIGHT edge at x, since its width is only known once
        // the text is measured in the page.
        //
        // x is the FRAME's right edge, not the gene's position, which is why it
        // and the tail beside it stay raw while the head anchors: anchoring the
        // pill to stx2B would move it off that edge, which is the one thing its
        // placement is about.
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
        // stop short of the stx2B label instead of landing on top of it — the
        // box below marks the gene itself. Offset toward the tail, which is now
        // on the right.
        anchor: { text: 'stx2B' },
        dx: 45,
        dy: -28,
      },
      {
        // grown upward off the label so it wraps the stx2B GLYPH as well —
        // the default label-sized box clipped the glyph along its top edge
        type: 'box',
        anchor: { text: 'stx2B' },
        dy: -14,
        height: 36,
      },
    ],
  },

  // The "One strain against all the others" section of allvsall_synteny.md: the
  // same all-vs-all track in a PLAIN LGV. With no second row there is no target
  // assembly, so the adapter draws K-12 against every other sample at once, and
  // LGVSyntenyDisplay's "Group by... > Mate assembly" splits that into one
  // section per strain. Baked into the session (facet on the track entry)
  // rather than driven through the menu, so the figure can't drift from it.
  //
  // The window is read off the PAF, not chosen for looks. K-12's phenylacetate
  // catabolism operon (paaABCDEFGHIJK + paaXY, chr:1,446,378-1,465,230, with
  // feaR/feaB/tynA just upstream) has no alignment at all in Sakai
  // (1,446,100-1,467,908 bare) or CFT073 (1,446,270-1,465,276 bare), while
  // NCTC86 runs through it in one 33 kb block (1,434,958-1,467,909). Neither
  // Sakai's nor CFT073's annotation carries a phenylacetate gene. The window
  // puts the shared flanks on both sides of that break, so two lanes visibly
  // stop where the third continues.
  //
  // The right edge reaches past 1,467,921 on purpose: the IS elements
  // insD2/insC2/insI2 sit immediately downstream of the island, and each one
  // aligns to ten-plus loci per strain. Under one-row-per-group those land on
  // top of each other, so they read as the dark ticks that the shading is for —
  // the same repeat pile that used to stack seven rows deep in every lane and
  // squeeze the actual synteny into a sliver.
  {
    mode: 'url',
    name: 'multiway_synteny/ecoli_one_vs_all',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/ecoli_pangenome/config.json',
      ),
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'K12',
            loc: 'chr:1,440,000-1,473,000',
            // The island itself, banded across every track so the gene block
            // and the two lanes that stop at its left edge are one object
            // rather than two things a reader has to line up by eye. Explicit
            // rgba because getHighlightColor uses a supplied color as-is. 0.13
            // is picked off the composite, not by eye: over white it lands at
            // (250,240,224), an obvious cream, while over a forward-strand bar
            // it moves (240,141,131) to (237,140,116) — invisible. That matters
            // because darker salmon already MEANS overlap depth here, so a band
            // heavy enough to tint the bars would read as data.
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
                type: 'LinearBasicDisplay',
                showOnlyGenes: true,
                displayMode: 'compact',
                // as above: the retired `showDescriptions: false` resolved to
                // 'auto'
                showLabels: 'auto',
              },
              // The graph's segments in the graph pane's own reference-position
              // ramp, so a node below and its span here share a hue.
              {
                trackId: 'ecoli_minigraph_segments',
                type: 'LinearBasicDisplay',
                color: referencePositionColor(PAA_COLOR_DOMAIN),
                height: 70,
              },
              {
                trackId: 'ecoli_ava',
                type: 'LGVSyntenyDisplay',
                facet: 'mateAssembly',
                // "Group by... > Hide self-alignment lane". K-12 cannot have a
                // line against itself — all_vs_all.paf is built with
                // `minimap2 -X`, which skips each sequence's own diagonal — so
                // its lane held only K-12's internal paralogy and every
                // reviewer read it as missing data. Hidden, the figure is the
                // four lanes it is actually about.
                hideSelfAlignments: true,
                // Same thicker bar as the whole-genome figure below, and for
                // the same reason: what the reader is asked to find is where a
                // lane STOPS, and a 7px bar makes that a hairline.
                featureHeight: 14,
                // One row per strain (the LGVSyntenyDisplay default), so the
                // track is its five lanes and nothing else. Stacked, four
                // groups already needed 210px, almost all of it empty: the row
                // count came from the IS-element pile at the right edge, not
                // from the synteny anyone is looking at.
                height: 135,
              },
            ],
          },
          // The graph of the same island, in the same frame (review: "I don't
          // see the graph in this screenshot. should be combined figure?").
          // What the lanes cannot say is what the strains that stop at the
          // island's left edge carry INSTEAD — sequence absent from the
          // alignment is absent from the PAF — and that is the short arm beside
          // the long node here.
          //
          // The gfatools slice rather than a graph track's cut of the segments
          // index: the tabix cut expands one hop off the region and a link is
          // indexed at its reference-side endpoint, so CFT073's and IAI39's
          // detours — which leave at s501 and rejoin at s506 — come in as 43
          // bp/558 bp stubs with nothing behind them, which is the opposite of
          // what this pane is here to show. `gfatools view -R … -r 1` walks the
          // graph itself. Same file, settings and ramp as pangenome/rgfa_paa_bubble,
          // which draws this graph under a three-strain synteny view.
          //
          // The plugin loads from the hosted demo config's own `esmUrl`, which
          // is on the generator's pre-approved list (trustCapturePlugins), so
          // the cross-origin plugin warning does not cover the capture.
          {
            type: 'GraphGenomeView',
            gfaLocation: { uri: `${ECOLI_DEMO_BASE}/ecoli_paa_subgraph.gfa` },
            layoutMode: 'force',
            colorScheme: 'reference-position',
            colorDomain: PAA_COLOR_DOMAIN,
          },
        ],
      },
    ),
    viewportHeight: 1290,
    // Both panes: the lanes' own done-marker AND the graph having drawn.
    // `body:has(A) B` is an AND — a bare list would be a CSS OR and fire on
    // whichever landed first, which here is always the lanes.
    //
    // GRAPH_VIEW_DRAWN rather than the perf readout, which is behind a display
    // setting now and stopped existing.
    readySelector: `body:has(${GRAPH_VIEW_DRAWN}) ${displayPainted('pileup-display')}`,
    readyTimeout: 120000,
    // name the island, since "three lanes stop here" is only interesting once
    // the reader knows what stops. One line; the rest is in the caption.
    annotations: [
      {
        // in the strip under the last lane, which is what the LGV's spare
        // height is for here
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
        // The island in the graph pane, ringed the way
        // pangenome/rgfa_paa_bubble rings it — same segment, same slice, so the
        // two figures mark the same node. Anchored through the view's own
        // nodePositions, which resolves to a point ON the polyline: the arc's
        // bounding-box centre is the empty space it encloses.
        type: 'circle',
        anchor: { view: 1, graphNode: 's502' },
        radius: 40,
      },
    ],
  },

  // The website/docs/tutorials/allvsall_synteny.md §"Launching a stacked view at one locus" section:
  // going from the one-vs-all lanes above to the stacked view of one locus,
  // which is the launch this figure documents. Three parts, each its own spec
  // and its own capture height, stacked by the `compose` below: the selection
  // and the offer it raises, the dialog that offer opens, and the view it
  // launches. Each is a UI chain rather than a session — the rubberband menu and
  // the dialog are only reachable by driving the UI, and baking the launched view
  // into a session would show the destination without the thing being documented
  // — but they are separate specs rather than `stages` of one so that each frame
  // is only as tall as its own state. As stages they shared the height the
  // five-row stack needs, which left the dialog frame mostly empty.
  //
  // Deliberately NOT the paa window ecoli_one_vs_all uses. That locus is the one
  // place in the genome where three of the four strains have no alignment at
  // all, so a selection inside it discovers a single mate and the launch
  // degenerates to the pairwise case this section is contrasting against. This
  // is a shared-backbone window instead, where every strain aligns and the
  // launch produces the five-row stack.
  ...launchFromSelectionParts(),
  {
    mode: 'compose',
    name: 'multiway_synteny/ecoli_launch_from_selection',
    parts: [
      'multiway_synteny/ecoli_launch_selection',
      'multiway_synteny/ecoli_launch_dialog',
      'multiway_synteny/ecoli_launch_result',
    ],
  },
  // The whole-genome end of the same "One strain against all the others"
  // section: the figure above, zoomed all the way out over K-12's 4.6 Mb. Same
  // track (ecoli_ava) on purpose — it is this tutorial's own all_vs_all.paf, and
  // "the same mode zoomed out" should be literally the same lanes.
  //
  // It used to run on ecoli_pggb_ava (MultiGenomeIndexedPAFAdapter) to cover the
  // indexed adapter in a plain LGV. That was wrong twice over, both in the
  // hosted asset rather than in our code, and both invisible in a caption:
  //
  //  - Wrong NCTC86. jbrowse.org/demos/ecoli_pangenome/ecoli_pggb_ava.pif.gz
  //    carries NCTC86#1#chr = 4,903,501 bp (GCF_003697165.2) while every
  //    assembly in that same config — and all_vs_all.paf.gz — is 5,111,920 bp
  //    (GCF_002007705.1). The two deposits of the isolate are
  //    reverse-complements, so all 34 K-12/NCTC86 rows drew reverse-strand: a
  //    solid blue lane that reads as a whole-genome inversion and is an
  //    accession mismatch. ecoli_cactus_ava has the same 4,903,501 NCTC86, so
  //    the pangenome_cactus figures inherit it.
  //  - Reciprocal duplication. pggb's wfmash step emits each pair in both
  //    directions (K12|Sakai 21 rows and Sakai|K12 20 rows, and so on for all
  //    six pairs), so mean depth is 2.0 across the whole genome and the overlap
  //    shading darkened every lane uniformly — it meant "both directions", not
  //    "repeats". The two directions segment differently, so nothing downstream
  //    can dedupe them safely.
  //
  // all_vs_all.paf.gz has neither problem: 5,111,920 bp NCTC86, one direction
  // per pair. Fixing the pggb asset needs a rebuild and re-upload, and even then
  // the tabix point is thin here — a 4.6 Mb whole-chromosome query returns
  // essentially the whole file, so the index saves nothing at this zoom. The
  // prose now points at the make-pif section instead of claiming the figure
  // demonstrates it.
  //
  // Both representations of that PAF are in ONE frame (reviewer: "would be cool
  // to show this and the multi-way synteny in same figure, so that we could see
  // the inversions"). The lanes live on the K-12 row of a LinearSyntenyView
  // rather than in a separate view, so they share that row's axis with the four
  // ribbon bands below them: IAI39's inversions are the blue stretches in the
  // top lane AND the crossings in the bottom band, at the same x.
  {
    mode: 'url',
    name: 'multiway_synteny/ecoli_one_vs_all_whole_genome',
    url: ecoliOneVsAllUrl(120),
    viewportHeight: 890,
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
  },

  // allvsall_synteny.md §"Percent identity per strain": the page's own fence,
  // which is the Display types -> Marks default written out plus the filter
  // dropping K-12's alignments to itself.
  {
    mode: 'url',
    name: 'multiway_synteny/ecoli_identity_rows',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/ecoli_pangenome/config.json',
      ),
      {
        sessionTracks: [ECOLI_IDENTITY_TRACK],
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'K12',
            loc: 'chr:1-4,641,652',
            tracks: [
              {
                trackId: 'ecoli_ava_identity',
                type: 'LinearMarkDisplay',
                height: 400,
              },
            ],
          },
        ],
      },
    ),
    viewportHeight: 620,
    readySelector: displayPainted('mark-display'),
    readyTimeout: 120000,
  },

  // The Linear synteny view import form for the allvsall_synteny.md "From the
  // UI" section, using the all-vs-all Quick start path. A bare LinearSyntenyView
  // session spec is rejected (needs >=2 views), so open it the way a user does:
  // load the ecoli_pangenome demo config with no views, then Add -> Linear
  // synteny view -> an empty view that lands on the import form. The form opens
  // in Quick start with the config's synteny track already selected, so the rows
  // it implies are on screen immediately: one single-stage figure, no
  // menu-driving, annotating the three things the tutorial names: the mode
  // toggle, the track, and the rows it fills.
  {
    mode: 'url',
    name: 'multiway_synteny/ecoli_import_form',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/ecoli_pangenome/config.json',
      ),
      { views: [] },
    ),
    readyText: 'Select a view to launch',
    readyTimeout: 60000,
    // Quick start is a short form (a select, the rows it implies, Launch), so
    // this is sized to the form rather than the taller manual row stack
    viewportHeight: 356,
    clicksChange: "open a Linear synteny view's import form from the Add menu",
    actions: [
      { type: 'click', text: 'Add' },
      { type: 'waitForText', text: 'Linear synteny view' },
      { type: 'click', text: 'Linear synteny view' },
      // the rows summary only renders once a track is selected, so waiting on it
      // is a real readiness signal rather than a duration guess
      {
        type: 'waitForSelector',
        selector: '[data-testid="quick-start-rows"]',
      },
      { type: 'delay', ms: 1000 },
    ],
    // Both pills sit in the import form's empty right half, with their arrows
    // running left into the controls they name. Heads anchor; the pills and the
    // tails stay raw and stay together — a pill placed against THIS frame's
    // empty space, with the arrow leaving its edge, is one unit in page
    // coordinates, and anchoring only the tail would pull the arrow off the pill
    // the first time the form's layout moved.
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
      // box the rows the chosen track fills in (reviewer)
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
      // pointed at the rows, not at Launch: a submit button at the bottom of a
      // form needs no callout, and an arrow across the frame to reach it was
      // the largest thing in the figure (reviewer)
      {
        type: 'arrow',
        from: { x: 770, y: 220 },
        anchor: { selector: '[data-testid="quick-start-rows"]' },
      },
    ],
  },

  // The pairwise MCScan figure for tutorials/mcscan_synteny_grape_peach.md: peach Pp05 vs
  // grape chr2, the per-gene .anchors ribbons between them and the
  // .anchors.simple blocks (red collinear / blue inverted) as an
  // LGVSyntenyDisplay row in each panel — both adapters in one view, which is
  // what the tutorial is about.
  //
  // Was the last `share-` link in the repo. Decrypting that session showed why
  // it had to go: a frozen Apr-2021 snapshot, so the capture baked its stale
  // "Grape vs Peach (small) 4/2/2021" session name into the title bar, and its
  // grape panel sat at a negative offsetPx — scrolled left of the region start,
  // leaving a grey off-region block in the corner of the figure. The locs below
  // are read off that capture's own location boxes, so the view is the same
  // minus the dead space; `sessionName=Screenshot` comes from sessionSpec().
  // Strand coloring needs no slot — it's the LGVSyntenyDisplay `color` default.
  //
  // As a share session this figure incidentally covered the legacy per-instance
  // `heightPreConfig` path — an alignments-base refactor once dropped that prop,
  // discarding the session's stored 28/52px synteny heights so both panels fell
  // back to the 250px alignments default. Setting `height` directly here retires
  // that incidental coverage, which is fine: the session migration owns it and
  // sessionMigrations.test.ts covers it directly.
  {
    mode: 'url',
    name: 'mcscan_anchors',
    url: sessionSpec(DOTPLOT_CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          drawCurves: true,
          // both MCScan tracks on one level: the coarse anchor set plus the
          // simple per-gene anchors drawn over it
          tracks: [
            ['grape_peach_synteny_mcscan', 'grape_peach_synteny_mcscan_simple'],
          ],
          levelHeights: [236],
          views: [
            {
              assembly: 'peach',
              loc: 'Pp05:7,380,181-14,148,567',
              tracks: [
                {
                  trackId: 'grape_peach_synteny_mcscan_simple',
                  type: 'LGVSyntenyDisplay',
                  height: 60,
                },
              ],
            },
            {
              assembly: 'grape',
              loc: 'chr2:1-7,112,179',
              tracks: [
                {
                  trackId: 'grape_peach_synteny_mcscan_simple',
                  type: 'LGVSyntenyDisplay',
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
    // just the app, and enough for the lower panel's own synteny row: the old
    // capture left the bottom ~28% of the PNG blank
    viewportHeight: 640,
  },

  ...mcscanFilePartSpecs(),
  {
    mode: 'compose',
    name: 'mcscan_synteny/anchors_vs_simple',
    parts: ['mcscan_synteny/anchors', 'mcscan_synteny/anchors_simple'],
  },

  // The same MCScan run as a dotplot, which mcscan_synteny.md never mentioned:
  // one dot per orthologous gene pair, so the whole-genome plot is the one jcvi
  // itself draws, from the file the tutorial has already loaded. autoDiagonalize
  // reorders the grape axis to follow peach: in raw .fai order the same runs are
  // scattered over the plot, and grape has 19 chromosomes to peach's 8, so
  // reading which pairs correspond is the whole point of the reorder.
  //
  // Black, like every other dotplot here. Per-query coloring was tried and
  // dropped (reviewer): the diagonalized runs already separate on position, and
  // the palette only competes with them.
  {
    mode: 'url',
    name: 'mcscan_synteny/dotplot',
    url: sessionSpec(DOTPLOT_CONFIG, {
      views: [
        {
          type: 'DotplotView',
          views: [{ assembly: 'peach' }, { assembly: 'grape' }],
          tracks: ['grape_peach_synteny_mcscan'],
          autoDiagonalize: true,
        },
      ],
    }),
    readySelector: displayPainted('dotplot_webgl_canvas'),
    readyTimeout: 60000,
  },

  // mcscan_synteny.md's own thesis, which had no figure: an anchor is a gene
  // pair, so there is nothing to draw below the gene and no CIGAR under the
  // ribbon. Every other figure on that page is whole-chromosome, where that is
  // invisible.
  //
  // The window is chosen off the anchors file rather than by eye: this MCScan
  // block is 12 consecutive pairs, collinear, and its grape and peach spans are
  // the same 126 kb, so the ribbons run parallel instead of fanning and the
  // one-gene-to-one-gene reading is the obvious one. It is also the control -
  // 34 grape genes and 24 peach genes sit in these two windows and 12 of them
  // are anchored, so the genes MCScan did not pair are on screen beside the
  // ones it did, which is what stops the figure reading as "every gene has an
  // ortholog".
  //
  // showOnlyGenes on both rows: the default draws every mRNA isoform, and the
  // figure is about which gene pairs with which, not about transcript
  // structure. Straight chords, not curves - at this zoom a curve leaves its
  // gene vertically and only aims at its partner mid-band, which is exactly the
  // information the figure exists to carry.
  {
    mode: 'url',
    name: 'mcscan_synteny/gene_level',
    url: sessionSpec(DOTPLOT_CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          views: [
            {
              assembly: 'grape',
              loc: 'chr19:4,950,000-5,100,000',
              tracks: [
                {
                  trackId: 'grape_genes',
                  type: 'LinearBasicDisplay',
                  showOnlyGenes: true,
                  displayMode: 'compact',
                  showLabels: 'auto',
                  height: 70,
                },
              ],
            },
            {
              assembly: 'peach',
              loc: 'Pp04:11,975,000-12,125,000',
              tracks: [
                {
                  trackId: 'peach_genes',
                  type: 'LinearBasicDisplay',
                  showOnlyGenes: true,
                  displayMode: 'compact',
                  showLabels: 'auto',
                  height: 70,
                },
              ],
            },
          ],
          tracks: [['grape_peach_synteny_mcscan']],
          drawCurves: false,
          levelHeights: [220],
          // `alpha` is the default 0.2 (review: "we should just use default
          // 0.2"), so there is no key here at all.
          //
          // Worth keeping from the round that raised it: nothing in this band is
          // overplotted, though the frame invites the opposite guess, since an
          // anchors file keyed on transcripts would draw one ribbon per isoform
          // pair. Measured off the capture rather than argued -- every ribbon
          // pixel was exactly one layer of red over white, with no doubled
          // value anywhere in the band. So the darkness was the alpha alone.
        },
      ],
    }),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 60000,
    // two 70px gene lanes, their scalebars and a 220px band; 560 cut 53px off
    // the bottom, which is the peach gene lane the figure is half about
    viewportHeight: 616,
  },

  // Whole-genome human (hs1/T2T-CHM13) vs mouse (mm39) synteny, mirroring the
  // hs1_vs_mm39 config defaultSession: 500k minlen drops short-alignment
  // hairball noise, autoDiagonalize reorders mm39 chroms into clean diagonals,
  // and low alpha + per-query coloring give legible straight ribbons
  // (matches data/hs1ToMm39/ribbon-500k.png reference). Remote UCSC liftOver PIF
  // + two 2bit genomes, so allow a long ready/settle.
  {
    mode: 'url',
    name: 'hs1_vs_mm39_synteny',
    url: sessionSpec(HS1_MM39_CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['hs1ToMm39.over.chain.pif'],
          minAlignmentLength: 500000,
          drawCurves: false,
          autoDiagonalize: true,
          color: { field: 'query' },
          opacity: 0.4,
          levelHeights: [350],
          views: [{ assembly: 'hs1' }, { assembly: 'mm39' }],
        },
      ],
    }),
    viewportHeight: 672,
    readySelector: displayPainted('synteny_canvas'),
    // autoDiagonalize holds the synteny canvas (and thus synteny_canvas_done)
    // off-screen until the diagonalize RPC lands and the reorder is applied, so
    // the canvas only ever appears in its final diagonalized state. The remote
    // 2bit genomes + S3 PIF make that whole-genome fetch slow, so allow
    // generous headroom.
    readyTimeout: 180000,
  },

  // hg38 vs T2T-CHM13 at TNNT3, reproducing the genomes.jbrowse.org/demos/
  // session (Fig 5C of the T2T variation paper, science.abl3533). Called
  // against GRCh38 the locus looks like a 24 kb inversion plus a 22 kb deletion
  // ablating LINC01150 in every individual; against T2T-CHM13 the same 22 kb is
  // simply inversely transposed to the other side of TNNT3. Field 'strand'
  // paints that flipped segment against the collinear ribbons around it, so the
  // rearrangement is the only off-color block in the view. Curved ribbons plus
  // 'matches' (transparent indels) keep strand the only thing color means, which
  // is what makes the flipped block read at a glance.
  {
    ...TNNT3_FRAME,
    name: 'synteny_hg38_hs1_tnnt3',
    url: tnnt3Session(
      { drawCurves: true, cigarMode: 'matches' },
      { markLinc01150: true },
    ),
  },

  // Two-part figure for the genomes_synteny tutorial: the same view as it opens
  // (straight ribbons, colored indels) over the same view after the two ribbon
  // settings the tutorial points at. Each part is its own session, so the stack
  // can't drift from what the live links open.
  {
    ...TNNT3_FRAME,
    name: 'genomes_synteny/ribbons_default',
    url: tnnt3Session(),
    // The top frame also has to answer "where are those two settings?", so it
    // opens the header's settings menu: both rows the section asks the reader
    // to change are in it, one under the other, which is what this frame used
    // to need an open menu plus an open submenu to show. The live link still
    // opens the plain default state.
    actions: [
      { type: 'click', selector: '[aria-label="Synteny display settings"]' },
      { type: 'waitForText', text: 'CIGAR indels' },
      // the menu is its own compositor layer and swiftshader rasterizes it a
      // frame or two late: the capture came out with the menu blank and the
      // boxes floating over the track behind it. Same race as
      // bigwig/whole_genome_coverage, same fix.
      { type: 'delay', ms: 1000 },
    ],
    // box the two controls the section asks the reader to change, rather than
    // labelling the frame "As it opens" (which said nothing about the menu)
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
    // curved ribbons trace where each block lands instead of shearing across
    // the gap; 'matches' leaves the CIGAR indels see-through so the strand
    // coloring is the only thing painting the ribbons
    url: tnnt3Session({ drawCurves: true, cigarMode: 'matches' }),
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

  // genomes_synteny tutorial: the whole launch path in one figure, reached the
  // way a reader reaches it on genomes.jbrowse.org, from a plain hg38 LGV. Loads
  // that site's own hg38 config, so the track names, categories and menu are the
  // ones on screen there. That config declares only hg38; mm39 arrives on its
  // own because the Hubs plugin it loads answers Core-handleUnrecognizedAssembly
  // for the name the liftOver track references, and the launch menu item is
  // gated on exactly that mate assembly resolving.
  //
  // Four stages of one spec rather than four specs. The first three are one live
  // session — a context menu, the dialog it opens, the view that dialog creates
  // — each reachable only by driving the one before it. The fourth is the
  // RESULT, so it declares its own session (`url` on the stage) instead of being
  // clicked out of the third. They stay one spec because the grid is what puts
  // them side by side: `compose` appends committed PNGs with no gutter and no
  // rows, so a figure split across specs would lose the 2x2 layout below.
  //
  // In a 2x2 grid (`stageColumns`), not a column: stacked, four frames of the
  // same app chrome ran 4320px tall and a reader scrolled past the launch to
  // reach its result. The panels carry their step number, since a grid has two
  // reading orders and the numbers pick one.
  //
  // Human vs CHIMP at an FTO intron, not human vs T2T and no longer human vs
  // mouse. Same-species assemblies make every block near-identical and the
  // launched view says nothing a reader could not have guessed, so it has to be
  // cross-species; but mouse was the wrong kind of cross-species for a figure
  // whose payoff frame is a ribbon full of indel wedges. At ~90 My every gap is
  // a gap and none of them is attributable to anything, which is what the review
  // asked to fix ("a gene where the insertions and deletions are more clearly
  // assignable to a single transposon insertion").
  //
  // hg38 chr16:54,042,096-54,048,145 is a 6,049 bp **L1HS** — the youngest,
  // still-active human LINE-1 subfamily, so human-specific by subfamily — sitting
  // in an FTO intron. Read out of the hub's own RepeatMasker file
  // (jbrowse.org/ucsc/hg38/rmsk.bed.gz), with 641 bp of unique sequence between
  // it and the nearest upstream element (THE1D) and ~4.5 kb to the nearest
  // downstream one (AluSx), so the chain has clean anchors either side and the
  // insertion is a single gap rather than a repeat-dense smear.
  //
  // NOT the RB1/VAPB/PICALM loci: those are the linear-synteny guide's TE
  // figures and they read the same hg38ToPanTro6.over.pif.gz this hub track
  // does, so reusing one would republish an existing picture from a different
  // menu.
  //
  // 18 kb: about three window-widths of the element itself, so both flanks are
  // in frame with their repeats named. At the 300 kb this figure once opened on,
  // RepeatMasker was a solid strip rather than repeats and the CIGAR wedges were
  // a mass of overlapping triangles.
  //
  // The right-click is a locus plus a depth, not a selector: the blocks are
  // canvas-drawn, and the chain-block canvas fills the display's whole height,
  // so a bare `fracY` (or a selector's centre) lands well below the row of
  // blocks. The gene display carries an explicit height for a related reason —
  // an auto height is a function of how many isoforms RefSeq draws here, and
  // every track below it moves with it. That is what the depth is measured from
  // the synteny track's own top edge for.
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
            // RepeatMasker is open BEFORE the launch, not added after it. Two
            // things follow, and both are the point of the figure: the reader
            // can already line the repeats up against the gaps in the chain
            // below them, and "Copy this view's tracks into its panel" carries
            // both tracks into the human panel of the launched view — so the
            // step left over for the last frame is the mouse panel, one panel
            // rather than four tracks across two.
            {
              trackId: 'hg38-rmsk',
              type: 'LinearBasicDisplay',
              displayMode: 'compact',
              // labels on: at 18 kb this window holds about a dozen elements, so
              // the names fit on one row, and the one on the L1HS is what the
              // whole figure is pointing at
              height: 70,
            },
            {
              // stacked, not the one-row-per-group default: the collapsed band
              // is a single row of merged blocks, so a right-click lands on
              // whatever fragment is under the cursor. Stacked, the long
              // conserved chains are their own bars and the launch can be aimed
              // at a big one.
              trackId: 'hg38_to_panTro6_liftOver',
              type: 'LGVSyntenyDisplay',
              collapseGroupRows: false,
              // one row: this window sits inside a single chromosome-scale
              // chain, so the rest of the display would be empty canvas under
              // the menu
              height: 60,
            },
          ],
        },
      ],
    }),
    // 900, not the 1200 the column version used: two of these side by side is
    // the composed width, and the frame still holds the launch dialog (~500px)
    // and the context menu.
    viewportWidth: 900,
    // the top row's height: tall enough for the whole context menu in stage 1
    // (the binding frame) — the menu opens below the clicked block, and the boxed
    // "Linear synteny view with panTro6" item sits in its Launch submenu. The
    // bottom row sets its own, taller, height per stage.
    viewportHeight: 575,
    stageColumns: 2,
    hideTooltip: true,
    // resolving mm39 through the hub plugin raises a "Successfully loaded"
    // snackbar over whichever frame the connection lands in
    hideSelectors: ['.MuiSnackbar-root'],
    readySelector: displayPainted('pileup-display'),
    // the UCSC hub config is ~570 tracks and pulls three remote plugins
    readyTimeout: 120000,
    stages: [
      {
        // taller than the other three: the Launch cascade opens below the
        // clicked block, and at 575 the submenu lands over its own parent row
        viewportHeight: 700,
        actions: [
          // chr16:54,038,800 is inside the long conserved chain that flanks the
          // L1HS — the big block the launch is aimed at — and 4px down is the
          // block row, which is the top ~7px of the display. Left of centre, so
          // the Launch submenu opens to the right of its parent rather than
          // flipping back over it.
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
          // leave the item the reader is being pointed at under the cursor, so
          // it carries the menu's own hover highlight as well as the box below
          { type: 'hover', text: 'Linear synteny view with panTro6' },
          { type: 'delay', ms: 500 },
        ],
        annotations: [
          // fontSize 30 on ALL FOUR step labels (reviewer: "please make the
          // red textboxes larger", then "i do not like the varying text
          // sizes"), up from 20, which was BELOW the overlay's own 22 default,
          // and these are the four-panel grid's only signposts, read at
          // whatever size a 2x2 of 900px frames ends up on the page. Stage 4's
          // label was the one left at 20 and it was left there because it was
          // the longest; it is shortened instead, so no frame's signpost is a
          // different size from its neighbours'.
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
          // "Replace current view", not "Open in new view": the launch is
          // anchored on the locus the LGV above is already showing, so the
          // alternative leaves two views of one place stacked and this frame
          // spends its top half restating stage 1. Both buttons are the dialog's
          // own, and the prose names the choice.
          { type: 'click', text: 'Replace current view' },
          {
            type: 'waitForSelector',
            selector: displayPainted('synteny_canvas'),
            timeout: 120000,
          },
          // mm39 resolves through the hub plugin and the chain track refetches
          // at the launched view's own bpPerPx, both after the canvas first
          // paints
          { type: 'delay', ms: 10000 },
        ],
        // The synteny view alone now, so this frame is its own height: the
        // human panel (the launching view's two tracks, copied), the band, and
        // the mate panel's empty-state block. That block is ~120px shorter than
        // the two tracks stage 4 puts in its place, so the two cells of the row
        // cannot both be full — compose pads this one, and padding it is better
        // than clipping stage 4 or squeezing four tracks to fit.
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
      // The payoff frame: the same comparison once BOTH panels have genes and
      // repeats. Stage 3 is what the launch hands you — its human panel arrives
      // carrying the launching view's gene track (anchorPanelTracks; the dialog's
      // "Copy this view's tracks into its panel"), and the mouse panel, which
      // nothing in that view can speak for, arrives empty. So the step left to
      // the reader is the mate panel plus the repeats on both, and the figure
      // shows the result rather than the click path to it.
      //
      // Declared as its own session rather than clicked together on the page
      // stage 3 left. The launched view is created by the app at click time, so
      // driving it means opening each panel's track selector, filtering, ticking
      // and closing — a dozen brittle clicks that also can't set a per-track
      // height, which is what lets this frame match its grid neighbour's.
      // Written as a session spec it is four track entries. Same view, same two
      // windows: the locstrings are the ones the CIGAR mapping produced in stage
      // 3, so this is that view with tracks on, not a different one.
      //
      // panTro6 needs no setup here either, for the same reason it needs none in
      // the LGV above: naming it resolves it through the hub plugin, which also
      // brings the panTro6 hub's tracks (jbrowse.org/ucsc/panTro6/config.json) —
      // which is where panTro6-ncbiRefSeq and panTro6-rmsk come from.
      //
      // drawCurves and cigarMode 'matches' ("Transparent indels"), both review
      // asks and both only meaningful on THIS frame: an indel drawn as a gap
      // rather than as a painted wedge is what makes the L1HS read as the human
      // side having sequence the chimp side does not, instead of as one more
      // colored triangle among the alignment's ordinary noise. Stages 1-3 keep
      // the defaults, since they are about the launch rather than about the
      // ribbon.
      {
        url: sessionSpec(UCSC_HG38_CONFIG, {
          views: [
            {
              type: 'LinearSyntenyView',
              tracks: [['hg38_to_panTro6_liftOver']],
              drawCurves: true,
              cigarMode: 'matches',
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
        // 690 cut 13.5 css px off the chimp RepeatMasker row, per the run's own
        // CONTENT CLIPPED report
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

  // The staging gene page's link into hg38's multi-way star, which production
  // gates off until a released host carries MultiWaySyntenyDisplay
  // (`features.multiwayStar` in jb2hubs). The ortholog table re-sorts while
  // "Working out which species" shows, moving the link down the page.
  {
    mode: 'url',
    name: 'genomes_synteny/star_link',
    noSession: true,
    url: TNNT3_GENE_PAGE,
    readySelector: STAR_LINK,
    readyTimeout: 90000,
    viewportWidth: 1100,
    viewportHeight: 760,
    liveLabel: 'Open the TNNT3 gene page',
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
    // H9 hap2, the H2 inversion carrier, sits beside hg38 so its inverted
    // ribbons are the first band down; hap1 under it, red against hg38, puts
    // one person's two chromosomes side by side. Lane gene names off, since
    // the RefSeq track above names the genes once.
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
        ribbonColor: { field: 'strand' },
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

  // Both haplotypes of HG008T v3.2 against GRCh38, one dotplot each, tiled
  // side by side in one workspace. One plot with both haplotypes on the y axis
  // gives every GRCh38 chromosome two counterparts and doubles the diagonal,
  // so each view restricts its y axis to one haplotype with a
  // `displayedRegionNames` glob. GRCh38 on x keeps its natural order, and
  // autoDiagonalize reorders and flips the assembly's scaffolds on y.
  //
  // The session track is a PairwiseIndexedPAFAdapter, which strips the PIF q/t
  // refName prefixes a plain PAFAdapter leaves on and so matches the hosted
  // config's own track.
  {
    mode: 'url',
    name: 'sv_cgiab/dotplot_haplotypes',
    url: cgiabUrl({
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

  // H. pylori synteny tutorial (synteny_visualization.md) — live hpylori demo

  {
    mode: 'url',
    // assemblies intentionally not pre-set: supplying them auto-launches the
    // DotplotView, but this tutorial image is specifically the import form
    name: 'sv_synteny/dotplot_import',
    // sized to the content: the rest of the viewport was page background. 471
    // until the chromosome boxes became opt-in and each axis took its own row,
    // which the run's own below-the-fold report priced at 89 css px.
    viewportHeight: 561,
    url: hpyloriUrl({ views: [{ type: 'DotplotView', views: [{}, {}] }] }),
    // the hpylori config has synteny tracks, so the form opens in Quick start;
    // this tutorial is specifically about choosing each axis, so switch to
    // Manual rather than capture a mode the surrounding prose doesn't describe
    readyText: 'Quick start',
    readyTimeout: 60000,
    clicksChange: 'switch the import form to Manual',
    actions: [
      { type: 'click', text: 'Manual' },
      { type: 'waitForText', text: 'Select assemblies for dotplot view' },
      { type: 'delay', ms: 1000 },
    ],
    // No callouts: the import form already labels its two selectors ("x-axis
    // assembly"/"y-axis assembly"), and which assembly goes on which axis is
    // arbitrary here (the old "query"/"target" framing was a track-level
    // distinction the view doesn't impose), so added annotations only mislead
  },

  {
    mode: 'url',
    name: 'sv_synteny/dotplot',
    url: hpyloriUrl({
      views: [
        {
          type: 'DotplotView',
          tracks: ['26695_vs_j99.pif'],
          // Axis order matches what the import form's Quick start produces for
          // this track, so the tutorial's click-path lands on this exact plot:
          // assemblyNames is [query, target] = [j99, 26695], and a dotplot puts
          // query on y / target on x. hview is views[0], vview is views[1].
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

  // The "Coloring genes by ortholog" section of synteny_visualization.md: the
  // same three-strain stack with the gene tracks colored by their `gene`
  // attribute instead of one flat color, so a symbol carries one color down all
  // three panels.
  //
  // Review: "the colors are just very bad here". Most of the frame was one
  // strong magenta, and that was not a palette problem: two thirds of these
  // genes carry no `gene` attribute at all, only a locus tag, so every one of
  // them came out the same color and read as a large named group.
  //
  // The color is what the dialog writes, `{ field: 'gene' }`: each symbol
  // hashes into the curated categorical palette, so it keeps one color down all
  // three panels.
  {
    mode: 'url',
    name: 'sv_synteny/ortholog_colors',
    url: hpyloriSyntenyWithGenes({ geneColor: { field: 'gene' } }),
    readyText: 'NC_018939v1',
    readyTimeout: 60000,
    // the default 800 clips the bottom strain's gene labels
    viewportHeight: 842,
    // half of a side-by-side pair — see color_by_attribute_steps
    viewportWidth: 900,
  },

  // HOW A READER PRODUCES THE FIGURE ABOVE (review: "we may want to show users
  // how they do this in the app"). The section had the picture and the jexl and
  // no route between them, so the coloring read as something a config author
  // does rather than something a reader can do to the track in front of them.
  //
  // Track menu -> Color by... -> Attribute..., then the attribute's name. Over
  // the inversion window the genes carry more symbols than the key lists, so
  // the caption under the field says that; every symbol still takes its color.
  // The field is an Autocomplete,
  // so it is typed into by testid (its label text resolves to an element that
  // takes no focus), and Escape folds the suggestion list off the caption.
  //
  // The FIRST panel's track menu, by testid index. `track_menu_icon` is not
  // unique here -- three stacked panels each carry a gene lane -- and the
  // generator's text/selector lookup takes the smallest matching element, so
  // the selector names the 26695 panel's track container to scope it.
  {
    mode: 'url',
    name: 'sv_synteny/color_by_attribute',
    url: hpyloriSyntenyWithGenes(),
    readyText: 'NC_018939v1',
    readyTimeout: 60000,
    // the dialog is what the frame is for, and it opens centred over a stack
    // whose lower half is the other two strains
    viewportHeight: 842,
    // half of a side-by-side pair — see color_by_attribute_steps
    viewportWidth: 900,
    hideTooltip: true,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      { type: 'waitForText', text: 'Color by...' },
      { type: 'hover', text: 'Color by...' },
      { type: 'waitForText', text: 'Attribute...' },
      { type: 'click', text: 'Attribute...' },
      { type: 'waitForText', text: 'Color by attribute' },
      {
        type: 'type',
        selector: '[data-testid="color-by-attribute"]',
        value: 'gene',
        clear: true,
      },
      { type: 'waitForText', text: 'gene takes more than' },
      { type: 'press', key: 'Escape' },
      { type: 'delay', ms: 300 },
    ],
  },

  // The click and its result as ONE figure (review: "if needed, show the UI
  // steps as a side by side before and after image. e.g. the dialog/track menu
  // in part 1, then the result in part 2", then "use side-by-side figures" on
  // the stacked version this note used to argue for).
  //
  // Side by side is what a before/after is, and the argument the other way was
  // about pixels: each part is a three-panel stack, so at the default 1500 the
  // pair would be 3000x822 — nearly 4:1, and the docs' column halves each part
  // again. That is paid for in the PARTS rather than by stacking them: both are
  // 900 px wide now, which puts the composite at 1800x822. The panels lose no
  // content by it — each row is the same 12.6 kb window either way, and what
  // both halves are read for is which gene carries which colour, not the ruler.
  //
  // Both parts stay their own specs, so each still has its own live link under
  // the figure.
  {
    mode: 'compose',
    name: 'sv_synteny/color_by_attribute_steps',
    parts: ['sv_synteny/color_by_attribute', 'sv_synteny/ortholog_colors'],
    direction: 'horizontal',
  },

  // The mistake the tutorial's Troubleshooting table describes, and the app's own
  // report of it. `assemblyNames` on a synteny track is [query, target], the
  // reverse of the minimap2 argument order, so writing it the other way round is
  // the common misconfiguration: JBrowse then asks the adapter for the top row's
  // refNames and gets the bottom row's, which is what the one-shot check at view
  // load compares. A session track is the only way to state it — the hosted
  // config's own track is correct — so this reuses that PIF with the two names
  // swapped, and the view draws nothing because no name resolves.
  {
    mode: 'url',
    name: 'sv_synteny/assembly_order_warning',
    url: hpyloriUrl({
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
    // the warning icon IS the subject, so it is also the ready signal: it
    // appears when the load-time check has resolved, which is later than the
    // canvas reporting an empty draw
    readySelector: '[aria-label*="synteny warning"]',
    readyTimeout: 120000,
    // an empty band is the point here, so the shoot-time settled check has to
    // allow a view with nothing drawn in it
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

  // Dotplot launch, two-stage figure: top frame opens the app "Add" menu with
  // "Dotplot view" boxed; bottom frame is the import form it opens (launched
  // from an empty session so only the import form shows, no leftover LGV).
  // Replaces the old separate dotplot_menu screenshot. Narrow window + height
  // crop keep the figure tight on the menu and form.
  {
    mode: 'url',
    name: 'dotplot_add',
    url: sessionSpec(VOLVOX, { views: [] }),
    readyText: 'Select a view to launch',
    viewportWidth: 900,
    // slightly shorter crop for both frames
    crop: { x: 0, y: 0, width: 900, height: 460 },
    stages: [
      {
        actions: [
          { type: 'click', text: 'Add' },
          { type: 'waitForText', text: 'Dotplot view' },
        ],
        // box the Add menu button as well as the Dotplot view item
        annotations: [
          { type: 'box', anchor: { text: 'Add' } },
          { type: 'box', anchor: { text: 'Dotplot view' } },
        ],
      },
      {
        actions: [
          { type: 'click', text: 'Dotplot view' },
          // volvox has synteny tracks, so the form opens in Quick start; this
          // figure is about picking assemblies by hand, which is Manual
          { type: 'waitForText', text: 'Quick start' },
          { type: 'click', text: 'Manual' },
          { type: 'waitForText', text: 'Select assemblies for dotplot view' },
          { type: 'delay', ms: 1500 },
        ],
      },
    ],
  },

  // Two-stage figure: (top) dotplot drag-selection context menu showing "Open
  // linear synteny view", (bottom) the linear synteny view it launches.
  // Uses the curated MCScan anchor tracks (the same pair the linear_synteny
  // figure uses) rather than the raw grape_peach_paf. A small drag-selection
  // over one diagonal block in the lower-left (peach Pp01 vs grape chr1) launches
  // a legible synteny view instead of the whole-genome criss-cross the reviewer
  // rejected.
  {
    mode: 'url',
    name: 'synteny_from_dotplot_view',
    // Left at the default 800 despite ~380px of page background under the
    // bottom frame. The drag below is a raw dotplot-canvas coordinate, so any
    // height change moves the block it is aimed at and the launch never
    // happens: tried 440, the synteny canvas never appeared. Re-deriving the
    // drag is the prerequisite, not the height.
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
      // small rubberband-drag over a single diagonal block in the lower-left
      // (a focused subsection, not the whole region — reviewer; ~75% of the
      // previous drag span, centered on the same block)
      { type: 'drag', from: { x: 126, y: 259 }, to: { x: 224, y: 311 } },
      { type: 'waitForText', text: 'Linear synteny view' },
      { type: 'delay', ms: 1000 },
    ],
    // The drag ends on the dotplot canvas, so its position readout was left
    // hanging over the selection the top frame is OF, reading "x - out of
    // bounds". Hidden at the shot rather than cleared with PARK_CURSOR: the
    // cursor is what holds the rubberband and the context menu that go with it.
    hideTooltip: true,
    stages: [
      // top frame: the context menu left open by the shared actions above
      {},
      // bottom frame: launch the linear synteny view, close the now-redundant
      // dotplot view (views[0], so the first close_view button) and let it draw
      {
        actions: [
          { type: 'click', text: 'Linear synteny view' },
          {
            type: 'waitForSelector',
            selector: displayPainted('synteny_canvas'),
          },
          { type: 'delay', ms: 2000 },
          { type: 'click', selector: '[data-testid="close_view"]' },
          { type: 'delay', ms: 2000 },
        ],
      },
    ],
  },
  // A chromosome against itself, which no pairwise plot can produce: the filled
  // wedge on the diagonal at ~9.3 Mb is the TSPY tandem array, and the lattice
  // of off-diagonal crossings at 21-26 Mb is the Yq palindrome family, each arm
  // meeting its own inverted copy.
  //
  // The alignment covers chrY:2,700,000-26,600,000 (PAR1 through the end of the
  // euchromatic MSY), so the view frames that rather than the whole chromosome:
  // Yq12 is ~30 Mb of DYZ satellite that minimap2 with -P does not finish on in
  // reasonable time, and it would be empty here.
  //
  // 25 kb minimum. Below ~30 kb the dispersed repeats black the plot out
  // entirely, above ~100 kb only the palindromes survive.
  //
  // The config's two assemblies read a two-line chrY chrom.sizes checked in
  // beside it rather than UCSC's hs1.chrom.sizes.txt, which is what this spec
  // originally used. hgdownload timed the fetch out mid-render and failed the
  // spec, and a remote file that only ever supplies one line's worth of
  // information here is not worth the dependency. It also keeps hs1's other
  // ~2000 contigs off both axes.
  //
  // If this ever hangs with no error, suspect a remote fetch rather than
  // anything about the config: an assembly named after a refName it contains
  // was the first theory and it is wrong, verified by rendering that exact
  // naming against the local chrom.sizes.
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
          minAlignmentLength: 25000,
        },
      ],
    }),
    // near-square, so the diagonal reads at 45 degrees and the palindrome
    // crossings stay symmetric
    viewportWidth: 1000,
    viewportHeight: 760,
    readySelector: displayPainted('dotplot_webgl_canvas'),
    // 21 MB PIF plus the hs1 chrom.sizes, both remote
    readyTimeout: 180000,
    // THE TWO STRUCTURES, BOXED (reviewer: "this is kind of chaotic, we might
    // need to cross reference paper ... is the liftover even accurately
    // representing this"). The caption already named both, but a reader has to
    // find them among a few hundred dispersed-repeat blocks that are real
    // alignments at this minimum length and cannot be filtered away without
    // taking the palindromes with them. Boxing them is what a caption cannot
    // do.
    //
    // Cells, not pixels: a dotplot anchor takes a locstring per axis, so these
    // follow the plot at any width or zoom. The coordinates are the published
    // ones -- TSPY at chrY:9.05-9.75 Mb and the P1-P5 palindrome family across
    // Yq at 21.2-26.0 Mb in T2T-CHM13v2 -- rather than read off the picture.
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

  // TWO PARTS, DOTPLOT FIRST (review: "it is unclear what 'inversion on top of
  // match' ... actually even means. is this a 'alignment artifact'? truly an
  // exact palindrome? if it is, add a red text box saying what this is. make it
  // a multipart figure including the dotplot as first part.").
  //
  // The top part is NOT `dotplot_self_chry` re-used. That one is the whole
  // 23.9 Mb MSY and it already sits on the same page directly above this
  // figure, so composing it in would print the same picture twice. This is the
  // 4.8 Mb the whole-MSY plot boxes as `Yq palindromes`, at the SAME 100 kb
  // minimum length the ribbons below use -- which is what makes the two parts
  // one figure: the four crossings this plot draws are the only four inverted
  // alignments over 100 kb in the window, and the boxed one is the ribbon.
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
          // 100 kb, not the whole-MSY plot's 25 kb. At 25 kb over 4.8 Mb the
          // dispersed repeats are back and the four crossings are again
          // something to find; at 100 kb they are what is left, and it is the
          // filter the second part draws with.
          minAlignmentLength: 100000,
        },
      ],
    }),
    // square, so the diagonal is at 45 degrees and each palindrome's crossing
    // is symmetric about it; same width as the part below
    viewportWidth: 1000,
    // 740, not 700: at 700 the run reported 39.9 css px under the fold, which
    // is this plot's bottom axis and its tick labels
    viewportHeight: 740,
    // one of the three `_done` selectors ADR-065's sweep missed; the suffix no
    // longer exists, so this spec could not have regenerated
    readySelector: displayPainted('dotplot_webgl_canvas'),
    readyTimeout: 180000,
    annotations: [
      // Which crossing the lower part opens. A dotplot anchor is a locstring
      // per axis, so this follows the plot rather than a measured pixel.
      {
        type: 'box',
        anchor: {
          hLoc: CHRY_P_PALINDROME_WINDOW,
          vLoc: CHRY_P_PALINDROME_WINDOW,
        },
      },
      // AN ARROW, NOT A SENTENCE (review: "still is presumptive and says 'this
      // one, below'. that says nothing. just draw arrow to lower area"). It
      // was right: the pill named no crossing and no direction, and the reader
      // had to already know the figure was two parts. The arrow leaves the box
      // and runs to the bottom edge of this part, which is the seam the lower
      // part starts at. A compose has no annotation layer of its own, so
      // nothing can be drawn ACROSS that seam -- pointing at it is as far as
      // this can go, and it is further than the words got.
      {
        type: 'arrow',
        strokeWidth: 3,
        fromAnchor: {
          hLoc: CHRY_P_PALINDROME_WINDOW,
          vLoc: CHRY_P_PALINDROME_WINDOW,
          alignY: 'bottom',
          dy: 16,
        },
        // The head takes the SAME locus anchor as the tail, not the canvas
        // element: a selector anchor centres on the element, so the arrow
        // sloped away to the middle of the plot instead of running straight
        // down out of the box. `dy` carries it to just above the bottom axis.
        anchor: {
          hLoc: CHRY_P_PALINDROME_WINDOW,
          vLoc: CHRY_P_PALINDROME_WINDOW,
          alignY: 'bottom',
          dy: 122,
        },
      },
    ],
  },

  // The reviewer's own alternative to the plot above: "this is kind of chaotic,
  // we might need to cross reference paper or make linearsyntenyview of same
  // thing." The paper is cited on the page now, and this is the other half --
  // the SAME track and the SAME minimum length as the dotplot, over the interval
  // that plot boxes as `Yq palindromes`, drawn as ribbons instead of points.
  //
  // Three things do the de-cluttering, and none of them filters any alignment
  // the dotplot draws:
  //
  //  - THE WINDOW. 4.8 Mb rather than the whole 23.9 Mb MSY, so the dispersed
  //    repeat content that IS the scatter is ~a fifth as much of it.
  //  - `color: { field: 'strand' }`, which is the one encoding a dotplot cannot spare an
  //    axis for. A palindrome arm meets its partner inverted, so the crossings
  //    the plot draws as an X are the minus-strand colour and the collinear
  //    self-match running the length of the panel is the plus-strand one.
  //  - `drawCurves` with `cigarMode: 'matches'` (the menu's "Transparent
  //    indels"). Bezier edges leave and arrive perpendicular to their panels, so
  //    the two arms pinch at the palindrome's own centre and flare against the
  //    panel edges rather than crossing as one hard X; the indels inside each
  //    arm are left as gaps in the fill instead of being drawn in their own
  //    colour over it.
  //
  // Both panels frame the same interval, so every ribbon has both corners in
  // frame -- the off-frame-corner failure that made `cancer_sv/derivative_inserts`
  // draw nothing is not reachable here.
  {
    mode: 'url',
    name: 'synteny_self_chry_palindromes_zoom',
    url: sessionSpec('test_data/chry_self/config.json', {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['hs1_chrY_self'],
          color: { field: 'strand' },
          drawCurves: true,
          cigarMode: 'matches',
          minAlignmentLength: 100000,
          opacity: 0.4,
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
    // 420 + the two gene lanes and their rulers, off the run's own
    // below-the-fold report
    viewportHeight: 602,
    readySelector: displayPainted('synteny_canvas'),
    // 21 MB PIF plus the hs1 chrom.sizes, both remote
    readyTimeout: 180000,
    // WHAT THE TWO COLOURS ARE, and nothing else (review: "reduce wordiness.
    // just say, palindrome, is a full match (red) and inverted match (blue)").
    // It was four lines answering an older round's "is this an alignment
    // artifact?", and that answer is now the caption's job. The colours are the
    // display's own strand palette rather than the note's red/blue, so the pill
    // names the ones on screen.
    //
    // What the pill dropped, the figure gained: the two gene lanes carry the
    // RBMY1 copies mirrored about the centre, which is the same claim the
    // ribbons make and is not an assertion at all.
    //
    // FAR LEFT, deliberately. There is no empty space in this part -- the band
    // is ribbon edge to edge -- so the pill has to sit on it, and the far left
    // is where it costs least: the flare there is two flat horizontal bands,
    // one per strand, carrying nothing but the colours the pill is naming. The
    // crossing at the palindrome's centre, which is the whole shape, stays
    // clear. Anchored to the synteny canvas rather than to a coordinate,
    // because a synteny band is not a track and has no locus anchor.
    annotations: [
      {
        type: 'text',
        fontSize: 17,
        maxWidth: 380,
        text: 'a palindrome: a forward match (salmon) and an inverted one (lavender)',
        anchor: {
          // the bare testid, not `displayPainted(...)`: an annotation anchor
          // only has to FIND the element, and annotations are drawn after the
          // ready gate has already established that it painted. (It read
          // `synteny_canvas_done` before ADR-065, which no longer matches
          // anything -- the anchor would have resolved to nothing and failed
          // the spec.)
          selector: '[data-testid="synteny_canvas"]',
          alignX: 'left',
          alignY: 'top',
          dx: 16,
          dy: 18,
        },
      },
    ],
  },

  // The two parts as one figure. The name is the one the doc and the review log
  // already carry, so what moves is which spec renders it.
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

// What videos/synteny.ts films: the linear synteny import form with nothing
// filled in, which is where this page's three-strain figure comes from. Two
// empty rows is the request for that form -- `launchSyntenyView` needs two rows
// to launch at all, and rows naming no assembly are what the view reads as
// "let me choose" (LinearSyntenyView/afterAttach.ts).
export const syntenyVideoFixtures = {
  emptySyntenyForm: hpyloriUrl({
    views: [{ type: 'LinearSyntenyView', views: [{}, {}] }],
  }),
  // Where the track-menu launch tour starts: the same grasses lane state its
  // still is of.
  grassesLanes: GRASSES_RICE_LANES,
  // Each row's dropdown lists the assembly's displayName, and the strain is the
  // part of it no other row shares.
  strains: {
    top: { label: '26695', assembly: 'GCF_000307795.1' },
    middle: { label: 'CHC155', assembly: 'GCF_025998455.1' },
    bottom: { label: 'J99', assembly: 'GCF_000982695.1' },
  },
  // Where the restack tour starts, which is the state
  // `multiway_synteny/blocks_one_vs_all` above captures: grape 11 with its genes
  // and the one .blocks track drawn as an LGVSyntenyDisplay, a lane per mate.
  //
  // A PLAIN LGV RATHER THAN THE PAGE'S STACKED FIGURE, and that is the launch's
  // own rule rather than a convenience. `launchableTracks` reads the LAUNCHING
  // VIEW's open tracks, and a LinearSyntenyView keeps its synteny track on the
  // level between two genome rows rather than on either row
  // (its `levels`), so a rubberband on a row of the stacked
  // demo session raises Zoom to region / Get sequence / Copy range and no Launch
  // submenu at all. This view has the track open, so it has the offer -- and it
  // is the reading the same section's second paragraph describes.
  restackLanes: sessionSpec(
    encodeURIComponent(
      'https://jbrowse.org/demos/grape_peach_cacao/config.json',
    ),
    {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GCF_030704535.1',
          loc: 'chr11:778,000-866,000',
          tracks: [
            {
              trackId: 'GCF_030704535.1-ncbiRefSeq',
              type: 'LinearBasicDisplay',
              showOnlyGenes: true,
              displayMode: 'compact',
              showLabels: 'auto',
            },
            {
              trackId: 'grape_peach_cacao_blocks',
              type: 'LGVSyntenyDisplay',
              facet: 'mateAssembly',
              featureHeight: 14,
              height: 140,
            },
          ],
        },
      ],
    },
  ),
  // The span the tour rubberbands, inside the window above. It has to carry a
  // .blocks row whose peach AND cacao cells both resolve, or the dialog opens on
  // one panel and there is no order to change: the grape locus at 836 kb is that
  // row -- `multiway_synteny/grape_peach_cacao_gene_orthologs` reads it out of
  // the two files, three grape copies against one peach transcript
  // (rna-XM_007203660.2) and one cacao -- and this span is around it rather than
  // against the window's own edges, where a rubberband end has nothing to land
  // on.
  restackSpan: { start: 'chr11:800,000', end: 'chr11:850,000' },
  // The reference column of this table, and so the row the reorder moves. Named
  // rather than spelled twice: it is the assembly the drag is made on, which is
  // what puts it at the top of the dialog's list (the anchor is row 0, then the
  // mates in the track's declared `assemblyNames` order).
  restackAnchor: 'GCF_030704535.1',
  // Where the all-vs-all launch tour starts, which is the state
  // `multiway_synteny/ecoli_launch_selection` captures: K-12 with the all-vs-all
  // PAF drawn as an LGVSyntenyDisplay, one lane per other strain. The same const
  // the three composite frames load, so the film and the stills cannot drift.
  allVsAllLanes: ECOLI_ONE_VS_ALL_LANES,
  roundTripStart: ECOLI_ROUND_TRIP_START,
  mafRows: ECOLI_MAF_ROWS,
  // The alignment lane the MAF tour drags across, and the reference span the
  // drag covers. The x is named on K-12 because that is the axis the rows are
  // drawn against; which rows the drag catches is the `fracY` at each end.
  mafTrackId: 'ecoli_pggb_maf',
  mafRowSpan: { start: 'chr:800,300', end: 'chr:804,100' },
  // The span the round trip rubberbands on K-12: wide enough that Sakai's
  // alignments either side of its prophage both fall inside the launch's
  // outlier reach (1.5 selections from the median), so Sakai's panel spans it.
  roundTripSpan: { start: 'chr:787,000', end: 'chr:828,000' },
  // The span the tour rubberbands, which is the span the composite's own drag
  // covers (`launchFromSelectionParts` measures it in pixels; this names it).
  //
  // It has to reach every strain, or the dialog opens on fewer rows than the
  // page's five and the reorder has less to move. It does: all four mates carry
  // K-12-side blocks across chr:800,000-808,000 in all_vs_all.paf, and it is a
  // shared-backbone window rather than the paa operon `ecoli_one_vs_all` uses --
  // that locus is the one place three of the four strains align to nothing, so a
  // selection inside it discovers one mate and degenerates to the pairwise case.
  allVsAllSpan: { start: 'chr:800,000', end: 'chr:808,000' },
  // The row the tour moves, and the order it moves it out of. The dialog lists
  // the anchor first and then the mates in the TRACK's declared `assemblyNames`
  // order (pickMatesForRegion), which for ecoli_ava is
  // K12 / Sakai / CFT073 / NCTC86 / IAI39 -- so IAI39 opens last and reaches the
  // row under K-12 in three arrow clicks. Each click renames the button it was
  // made on, since PanelList's MoveButton carries the panel's position in its
  // own aria-label.
  allVsAllMoved: 'IAI39',
  // Where the liftOver launch tour starts: genomes.jbrowse.org's own hg38 config
  // with the hs1 chain track turned on at TNNT3, which is the state the page's
  // first two sections walk a reader to -- one box in the track selector, one
  // gene symbol in the location box.
  //
  // THE PAGE'S OWN PAIR, not the panTro6/FTO one its composite is taken on. The
  // launch lands on hg38 chr11 vs hs1 chr11 at this locus, which is the window
  // `synteny_hg38_hs1_tnnt3` is of, so the clip ends where the page's last two
  // figures start and the ribbon settings section has something to change.
  //
  // Stacked rather than collapsed (`collapseGroupRows`, which this display
  // defaults to true so an all-vs-all track draws a lane per mate): three chain
  // blocks cover this window and the collapsed row merges them, so a right-click
  // would land on whichever fragment is under the cursor. Stacked, the
  // chromosome-scale chain is its own bar on the top row and the launch can be
  // aimed at it.
  liftoverLgv: sessionSpec(UCSC_HG38_CONFIG, {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'hg38',
        // the window `synteny_hg38_hs1_tnnt3` frames hg38 at, so the view the
        // launch builds is the one that figure is of
        loc: 'chr11:1,881,000-1,955,000',
        tracks: [
          {
            trackId: 'hg38-ncbiRefSeqCurated',
            geneGlyphMode: 'longestCoding',
            height: 90,
          },
          {
            trackId: 'hg38_to_hs1_liftOver',
            type: 'LGVSyntenyDisplay',
            collapseGroupRows: false,
            featureHeight: 14,
            height: 70,
          },
        ],
      },
    ],
  }),
  // The chain block the tour right-clicks, as a locus rather than a pixel. The
  // top row is one chromosome-scale chain (tchr11:60,000-135,076,382 in
  // hg38ToHs1.over.pif.gz) so any x in the window is on it, but not every x is on
  // a plain part of it: over the deletion the chain carries left of TNNT3 the
  // menu grows an "Open deletion details" row, which is the CIGAR op under the
  // cursor rather than the block the page says to right-click. Inside TNNT3 the
  // chain is plain, and it leaves the menu room to open rightward inside the
  // frame.
  liftoverBlock: 'chr11:1,925,000',
  // Where the dotplot reorder tour starts: `mcscan_synteny/dotplot` above
  // MINUS its `autoDiagonalize`, so the axes open in each assembly's own index
  // order and the move the page's figure is the result of is still to happen.
  //
  // The figure has the reorder baked in -- it is an init flag, run once as the
  // view opens, before the camera would be on -- so it cannot be the tour's
  // session. Everything else is the same session: the same config, the same
  // .anchors track, peach on the horizontal axis and grape on the vertical,
  // which is the axis the reorder moves (ReorderChromosomesDialog: "the
  // horizontal axis is the fixed reference").
  unorderedDotplot: sessionSpec(DOTPLOT_CONFIG, {
    views: [
      {
        type: 'DotplotView',
        views: [{ assembly: 'peach' }, { assembly: 'grape' }],
        tracks: ['grape_peach_synteny_mcscan'],
      },
    ],
  }),
}

// The three launch menus this site's prose walks a reader through and no still
// showed: the routes a right-click on one alignment offers, the hops off a
// multi-way lane's header, and the entries a drag across MAF rows raises. Each
// is the menu left open with the launch entries boxed; the views they open are
// the launch composites' and the tours' job.
function launchMenuStills(): ScreenshotSpec[] {
  return [
    {
      mode: 'url',
      name: 'multiway_synteny/ecoli_alignment_menu',
      url: ECOLI_ONE_VS_ALL_LANES,
      readySelector: displayPainted('pileup-display'),
      readyTimeout: 120000,
      viewportHeight: 440,
      hideTooltip: true,
      clicksOpen: "an alignment's context menu at its Launch submenu",
      actions: [
        // 8px into the first lane's row at featureHeight 14; the lanes are
        // canvas-drawn, so a locus and a depth is the only handle
        {
          type: 'rightclick',
          anchor: { trackId: 'ecoli_ava', loc: 'chr:801,000', fracY: 0, dy: 8 },
        },
        { type: 'waitForText', text: 'Open feature details' },
        // the Launch submenu arrives a fetch after the menu: its entries need
        // the alignment's mate, which says whether a synteny view can open
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
        encodeURIComponent(
          'https://jbrowse.org/demos/grape_peach_cacao/config.json',
        ),
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
                    domain: ['GCF_000346465.2', 'GCF_000208745.1', 'poplar'],
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
      hideTooltip: true,
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
      hideTooltip: true,
      actions: [
        // the tour's drag from the top row to the bottom one, ending short of
        // the tour's span so the menu the release raises opens inside the
        // frame rather than against its right edge
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
        // the jump submenu open, so the frame shows the three submenus and the
        // strains one of them holds
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
