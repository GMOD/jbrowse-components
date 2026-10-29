// Figures for the pangenome_hprc tutorial: the HPRC release 2
// minigraph-cactus graph over GRCh38.
import { displayPainted, displaySettled } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'
import {
  PORTAL_CONFIG,
  PORTAL_LOCI,
  portalGraphLaunch,
  portalLanesView,
} from './genomes_pangenome.ts'
import {
  GRAPH_DRAWN,
  cutNear,
  graphTrack,
  local,
  referencePositionColor,
} from './graph-fixtures.ts'

import type {
  ScreenshotAction,
  ScreenshotSpec,
} from '../screenshot-spec-types.ts'

const HPRC_CONFIG = local('test_data/graphgenomeview/hprc.json')
const SEGMENTS_TRACK = 'hprc_minigraph_segments'

// 1,780 bp of NA20809 hap 2, attached across the 12,021 bp of GRCh38 that is
// HLA-DRB5. The position ramp paints it black, having no reference position.
// `node scripts/probe-graph-nodes.ts pangenome/hprc_haplotype_launch` prints
// the cut's ids.
const HPRC_ALLELE = 's348700+'

// The bubble `hprc-v2.1-mc-grch38.bubbles.bed.gz` flags as an inversion at
// FLNA / EMD: lanes are one forward haplotype, both of HG00099's and a second
// carrier.
const INV_REGION = {
  refName: 'chrX',
  assemblyName: 'hg38',
  start: 154320000,
  end: 154410000,
}
const INV_WINDOW = `chrX:${INV_REGION.start + 1}-${INV_REGION.end}`
const INV_BLOCK = { refName: 'chrX', start: 154347246, end: 154384867 }
const INV_LANES = ['HG00097#1', 'HG00099#1', 'HG00099#2', 'HG01978#1']
const INV_LANES_VIEW = portalLanesView({ loc: INV_WINDOW, lanes: INV_LANES })

// C4. FMMM lays a near-path graph out as one thread, so a wider cut only
// shrinks every bubble; the force figures pass `maxRegionBp` a little over
// their window (agent-docs/reference/PANGENOME_GRAPHS.md).
const C4_WINDOW = 'chr6:31,980,000-32,050,000'

// Starts left of LPA (160,531,482): a window inside one gene draws its label
// off the left edge.
const LPA_WINDOW = 'chr6:160,525,000-160,655,000'
const MHC_CLASSII_REGION = {
  refName: 'chr6',
  assemblyName: 'hg38',
  start: 32510000,
  end: 32600000,
}

// The 12,014 bp REF of the four pgbi records whose ALTs are HPRC_ALLELE.
const MHC_MARKED_DELETION = '6:32,517,422-32,529,435'

// The lane packs 2-4 rows, and a pinned height clipped the last one at MHC and
// LPA.
function hprcSegmentsLane(domain: { start: number; end: number }) {
  return {
    trackId: SEGMENTS_TRACK,
    type: 'LinearBasicDisplay',
    labels: { name: { show: false }, description: { show: false } },
    heightMode: 'grow',
    encoding: { color: { value: referencePositionColor(domain) } },
  }
}

function hg38GeneLane(height: number) {
  return {
    trackId: 'hg38_ncbiRefSeq_ucsc',
    geneGlyphMode: 'representative',
    displayMode: 'compact',
    height,
  }
}

// A cut of UCSC's unipDomain.bb: hgdownload stalled past the app's 30 s limit
// during capture.
const HG38_UNIPROT_DOMAINS_TRACK = {
  trackId: 'hg38_uniprot_domains_lpa',
  name: 'UniProt domains (Swiss-Prot)',
  assemblyNames: ['hg38'],
  uri: 'https://jbrowse.org/demos/hprc/lpa_uniprot_domains.bed.gz',
}

// `alleleLength`: an insertion consumes no reference. One pgbi record is one
// whole allele, so size alone matches the graph's 50 bp minimum.
const ALLELE_FILTER = ['jexl:alleleLength(feature)>=50']
const PGBI_TRACK = 'hprc2_pgbi_grch38'

// What website/scripts/video-specs.ts films on this dataset

// `runClustering` stays absent: the tour clicks it.
export const hprcClusterFixtures = {
  session: sessionSpec(HPRC_CONFIG, {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'hg38',
        loc: 'chr6:32,510,000-32,600,000',
        tracks: [
          hg38GeneLane(60),
          hprcSegmentsLane(MHC_CLASSII_REGION),
          {
            trackId: PGBI_TRACK,
            height: 340,
            filter: ALLELE_FILTER,
          },
        ],
      },
    ],
  }),
  trackId: PGBI_TRACK,
  // the callset's fetch finished; first paint flips on an empty canvas
  ready: `${displayPainted('variant-display')}[data-display-phase="ready"]`,
  clustered: '[data-testid="tree_sidebar_dendrogram"]',
}

// One node per bubble (scripts/build_bubble_tier.sh): 474 for chr1, against
// ~751k segments.
const HPRC_TIER_SESSION_TRACK = {
  type: 'GraphTrack',
  trackId: 'hprc_tier',
  name: 'HPRC release 2 graph: bubble tier (one node per bubble)',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'RgfaTabixAdapter',
    uri: 'https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.tier10000',
    assemblyNameToPanSN: { hg38: 'GRCh38' },
  },
}

// MinigraphBubbleAdapter's `score` is the bubble's segment count. A
// FeatureTrack offers no wiggle display, hence the QuantitativeTrack.
const HPRC_BUBBLE_SCORE_SESSION_TRACK = {
  type: 'QuantitativeTrack',
  trackId: 'hprc_bubble_score',
  name: 'HPRC release 2 graph: variability (segments per bubble)',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'MinigraphBubbleAdapter',
    uri: 'https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.bubbles.bed.gz',
    assemblyNameToPanSN: { hg38: 'GRCh38' },
  },
}

// Uncolored, the lane is one gold bar; the stain is column 5 of the cytoBand
// BED, read as `gieStain`.
function cytobandLane() {
  return {
    trackId: 'hg38_cytobands_ucsc',
    displayMode: 'collapsed',
    labels: { name: { show: false }, description: { show: false } },
    encoding: {
      color: {
        value:
          "jexl:get(feature,'gieStain')=='acen' ? 'rgb(190,50,50)' : " +
          "get(feature,'gieStain')=='gvar' ? 'rgb(120,120,200)' : " +
          "get(feature,'gieStain')=='stalk' ? 'rgb(100,160,100)' : " +
          "get(feature,'gieStain')=='gneg' ? 'rgb(235,235,235)' : " +
          "get(feature,'gieStain')=='gpos25' ? 'rgb(190,190,190)' : " +
          "get(feature,'gieStain')=='gpos50' ? 'rgb(150,150,150)' : " +
          "get(feature,'gieStain')=='gpos75' ? 'rgb(110,110,110)' : 'rgb(70,70,70)'",
      },
    },
    height: 30,
  }
}

// NA20809 hap 2, HPRC_ALLELE's donor. The portal config aliases every
// haplotype by PanSN, so the node menu offers `Open in NA20809.2`.
const HAPLOTYPE = 'NA20809.2'
// HPRC_ALLELE's own span on the haplotype
const HAPLOTYPE_ALLELE_LOCUS = 'CM094351.1:32,495,297-32,497,076'
const HAPLOTYPE_GENES_TRACK = 'NA20809.2_cat_genes'
const HAPLOTYPE_GENES_DISPLAY = `${HAPLOTYPE_GENES_TRACK}-LinearBasicDisplay`
const HAPLOTYPE_GENES_READY = `[data-display-id="${HAPLOTYPE_GENES_DISPLAY}"][data-display-phase="ready"]`
// The launched view is the one holding the haplotype's genes.
const LAUNCHED_ZOOM_OUT = `[data-testid^="view-container-"]:has([data-display-id="${HAPLOTYPE_GENES_DISPLAY}"]) [data-testid="zoom_out"]`
const launchedZoomOut = (clicks: number): ScreenshotAction[] =>
  Array.from({ length: clicks }, () => [
    { type: 'click' as const, selector: LAUNCHED_ZOOM_OUT },
    { type: 'waitForAppSettled' as const, timeout: 120000 },
  ]).flat()
// The HLA / MHC launch at the class II window, in the force layout.
const MHC_FORCE_LAUNCH = portalGraphLaunch({
  loc: 'chr6:32,500,000-32,560,000',
  layoutMode: 'force',
})

const HOSTED_HPRC_CONFIG = 'https://jbrowse.org/demos/hprc/config.json'
const ABCA7_REPEAT_KEY = 'chr19:1049406-1050096'
const ABCA7_SAMPLES = [
  'HG00099',
  'HG03688',
  'HG00741',
  'HG02647',
  'HG01943',
  'HG02559',
  'HG04199',
]

// Walk rows read repeats only from the TRGT record: a FromConfigAdapter is not
// among their sources.
const ABCA7_VNTR_TRACK = {
  type: 'FeatureTrack',
  trackId: 'abca7_vntr',
  name: 'Tandem repeat catalogue (adotto)',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'FromConfigAdapter',
    features: [
      {
        uniqueId: 'abca7_vntr',
        refName: 'chr19',
        start: 1049407,
        end: 1050096,
        name: 'ABCA7 VNTR',
      },
    ],
  },
}

function abca7View({
  genes = true,
  pane = {},
}: {
  genes?: boolean
  pane?: Record<string, unknown>
} = {}) {
  return {
    type: 'LinearGenomeView',
    assembly: 'hg38',
    loc: 'chr19:1,049,000-1,050,500',
    tracks: [
      ...(genes
        ? [
            {
              trackId: 'hg38_ncbiRefSeq_ucsc',
              filter: ['geneLike'],
              displayMode: 'compact',
              height: 40,
            },
          ]
        : []),
      {
        trackId: ABCA7_VNTR_TRACK.trackId,
        height: 40,
      },
      {
        trackId: 'hprc_abca7_trgt',
        height: 40,
      },
      graphTrack('hprc_v2_1_walk_lanes', {
        layoutMode: 'walkrows',
        color: 'uniform',
        subgraphHaplotypes: [],
        repeatTrackId: 'hprc_abca7_trgt',
        repeatKey: ABCA7_REPEAT_KEY,
        paneHeight: 600,
        ...pane,
      }),
    ],
  }
}

const AMYLASE_LANES = portalLanesView(PORTAL_LOCI.amylase)

export const hprcGraphSpecs: ScreenshotSpec[] = [
  // At this span the fine segments track refuses with "Too many features" and
  // the tier draws.
  {
    mode: 'url',
    name: 'pangenome/hprc_whole_chromosome',
    url: sessionSpec(HPRC_CONFIG, {
      sessionTracks: [
        // The page's three chr1 loci, from those figures' own constants. They
        // rank in the top 2% of bubbles, not the tallest. A FeatureTrack, since
        // a highlight is a 0.7 px hairline at this span.
        {
          type: 'FeatureTrack',
          trackId: 'hprc_chr1_loci',
          name: 'Loci this page opens on chr1',
          assemblyNames: ['hg38'],
          adapter: {
            type: 'FromConfigAdapter',
            adapterId: 'hprc_chr1_loci',
            features: [
              {
                uniqueId: 'amylase',
                refName: 'chr1',
                start: 103_611_080,
                end: 103_732_636,
                name: 'amylase',
                type: 'region',
              },
              {
                uniqueId: 'inv_1q21',
                refName: 'chr1',
                start: 144_419_292,
                end: 144_572_458,
                name: '1q21.1 inversion',
                type: 'region',
              },
              {
                uniqueId: 'cfhr',
                refName: 'chr1',
                start: 196_753_088,
                end: 196_837_771,
                name: 'CFHR3/CFHR1 deletion',
                type: 'region',
              },
            ],
          },
        },
        HPRC_TIER_SESSION_TRACK,
        HPRC_BUBBLE_SCORE_SESSION_TRACK,
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr1',
          tracks: [
            // puts 1q12 on the bubbles' axis; 63 band names would be a mat
            cytobandLane(),
            {
              trackId: 'hprc_chr1_loci',
              // Not collapsed: collapsed drops the labels, which are the lane's
              // content.
              height: 50,
            },
            {
              trackId: 'hprc_bubble_score',
              type: 'LinearWiggleDisplay',
              height: 110,
            },
            {
              trackId: 'hprc_tier',
              type: 'LinearBasicDisplay',
              labels: { name: { show: false }, description: { show: false } },
              // Packed: collapsed lets one long bubble fill the 1q gap, and the
              // gap is the point.
              height: 60,
            },
          ],
        },
      ],
    }),
    readyTimeout: 300000,
    viewportWidth: 1400,
    // No graph pane: the tier is a path, so its drawing restates the lanes.
    viewportHeight: 580,
    tooltip: 'hide',
    // The blank is 1q12, not the centromere: bubbles are called across the
    // centromere (21 in the 124th Mb, 40 in the 125th). The pill sits in the
    // blank, the only spot it covers no data. At 178 kb per px an arrow to the
    // centromere draws as a smudge, so a box marks it.
    annotations: [
      // fontSize 14 and maxWidth 100 keep the pill inside the ~97 px blank; at
      // 17 it ran over the curve.
      {
        type: 'text',
        text: 'pericentromere (1q12)',
        fontSize: 14,
        maxWidth: 100,
        anchor: {
          trackId: 'hprc_bubble_score',
          loc: 'chr1:126,000,000',
          fracY: 0.08,
        },
      },
      {
        type: 'box',
        strokeWidth: 3,
        anchor: {
          trackId: 'hprc_tier',
          loc: 'chr1:121,700,000-125,100,000',
        },
      },
      {
        type: 'text',
        text: 'centromere',
        fontSize: 14,
        maxWidth: 100,
        anchor: {
          trackId: 'hprc_tier',
          loc: 'chr1:126,000,000',
          fracY: 0.06,
        },
      },
    ],
  },
  // Anchors come from `node scripts/probe-graph-nodes.ts
  // pangenome/hprc_graph_anatomy`.
  {
    mode: 'url',
    name: 'pangenome/hprc_graph_anatomy',
    url: sessionSpec(HPRC_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: C4_WINDOW,
          tracks: [
            hg38GeneLane(70),
            graphTrack(SEGMENTS_TRACK, {
              layoutMode: 'force',
              // 600 left 200 px blank between the legend and the drawing
              paneHeight: 440,
              color: { field: 'position' },
              maxRegionBp: cutNear(70_000),
              // a route chip sat over the C4A junction
              layers: { bubbles: false },
            }),
          ],
        },
      ],
    }),
    // No deletion callout: the renderer writes "32.7 kb del" across the arc.
    // Each leader meets its node near a right angle, so none reads as an edge.
    annotations: [
      // s329762+ is the 6.3 kb reference node beside C4A. The legend floats
      // over CYP21A2, so the leader drops from the empty top-left instead.
      {
        type: 'text',
        text: 'backbone',
        leader: true,
        fontSize: 20,
        anchor: { graphNode: 's329762+' },
        dx: 10,
        dy: -90,
      },
      // s352179+ is NA18948's 21 kb allele, the cut's largest off-reference
      // node.
      {
        type: 'text',
        text: 'allele',
        leader: true,
        fontSize: 20,
        anchor: { graphNode: 's352179+' },
        dx: 95,
        dy: 40,
      },
      // s329764+ is one wall of the clearest lens: the reference path beside
      // the 32.7 kb deletion arc.
      {
        type: 'text',
        text: 'bubble',
        leader: true,
        fontSize: 20,
        anchor: { graphNode: 's329764+' },
        dx: -70,
        dy: 110,
      },
    ],
    readySelector: GRAPH_DRAWN,
    readyTimeout: 120000,
    allowUnsettled: true,
    viewportWidth: 1000,
    viewportHeight: 780,
    tooltip: 'hide',
  },
  // No graph pane: nothing draws a node's orientation yet, so the force layout
  // drew the inverted block as straight backbone.
  {
    mode: 'url',
    name: 'pangenome/hprc_inversion',
    url: sessionSpec(PORTAL_CONFIG, {
      views: [
        {
          ...INV_LANES_VIEW,
          highlight: [{ ...INV_BLOCK, color: 'rgba(60,65,72,0.10)' }],
          tracks: [
            hg38GeneLane(60),
            {
              trackId: 'hprc_minigraph_bubbles',
              type: 'LinearBasicDisplay',
              filter: ['jexl:feature.inversion'],
              height: 60,
            },
            INV_LANES_VIEW.tracks[1],
          ],
        },
      ],
    }),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 240000,
    viewportWidth: 1000,
    viewportHeight: 680,
    tooltip: 'hide',
  },
  // pangenome/hprc_repeat_classes is retired. A synteny view of its two windows
  // fails: the liftOver chain paints one flat block across the band.

  // The KIV-2 bubble, picked from the bubble index. Force, since sample rows
  // drew its segments as stubs hanging off a lane.
  {
    mode: 'url',
    name: 'pangenome/hprc_lpa_kiv2',
    url: sessionSpec(HPRC_CONFIG, {
      sessionTracks: [HG38_UNIPROT_DOMAINS_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: LPA_WINDOW,
          tracks: [
            hg38GeneLane(70),
            {
              trackId: HG38_UNIPROT_DOMAINS_TRACK.trackId,
              type: 'LinearBasicDisplay',
              height: 75,
            },
            {
              trackId: 'hprc_minigraph_bubbles',
              type: 'LinearBasicDisplay',
              // pinned: growing only adds whitespace under the last two-line
              // label
              height: 80,
            },
            graphTrack(SEGMENTS_TRACK, {
              layoutMode: 'force',
              paneHeight: 600,
              color: { field: 'position' },
              layers: { bubbles: true },
              maxRegionBp: cutNear(130_000),
            }),
          ],
        },
      ],
    }),
    readySelector: GRAPH_DRAWN,
    readyTimeout: 180000,
    viewportWidth: 1000,
    viewportHeight: 1170,
    tooltip: 'hide',
    annotations: [
      // s343607+ is HG02391#2's 68 kb segment, the widest loop; the leader
      // comes in level, under the array's chip.
      {
        type: 'text',
        text: 'kringle copies on one haplotype, absent from GRCh38',
        fontSize: 18,
        maxWidth: 340,
        leader: true,
        anchor: { graphNode: 's343607+' },
        textAlign: 'end',
        dx: -137,
        dy: -6,
      },
      // No pill: every spot beside the box covered another bubble's label.
      {
        type: 'box',
        anchor: {
          trackId: 'hprc_minigraph_bubbles',
          loc: 'chr6:160,616,002-160,646,753',
        },
        pad: 3,
      },
    ],
  },
  // The graph names one source assembly per allele and the VCF every haplotype,
  // so the rows cannot line up with the graph; the band and ring mark one
  // allele in both instead.
  {
    mode: 'url',
    name: 'pangenome/hprc_graph_vs_callset',
    url: sessionSpec(HPRC_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr6:32,500,000-32,560,000',
          highlight: [MHC_MARKED_DELETION],
          tracks: [
            hg38GeneLane(60),
            {
              trackId: PGBI_TRACK,
              // 462 rows are a texture at any affordable height
              height: 340,
              filter: ALLELE_FILTER,
              runClustering: true,
            },
            graphTrack(SEGMENTS_TRACK, {
              layoutMode: 'force',
              paneHeight: 600,
              color: { field: 'position' },
              maxRegionBp: cutNear(60_000),
            }),
          ],
        },
      ],
    }),
    // ANDed with :has(); a comma list is a CSS OR and fires on whichever lands
    // first. First paint alone flips on an empty canvas.
    readySelector: `body:has(${GRAPH_DRAWN}):has([data-testid="tree_sidebar_dendrogram"]) ${displayPainted('variant-display')}[data-display-phase="ready"]`,
    readyTimeout: 360000,
    viewportWidth: 1000,
    viewportHeight: 1340,
    tooltip: 'hide',
    // The arrow's head stops a ring radius short: an anchored head resolves to
    // the node's centre, inside the circle.
    annotations: [
      {
        type: 'circle',
        anchor: { graphNode: HPRC_ALLELE },
        radius: 26,
        strokeWidth: 3,
      },
      {
        type: 'arrow',
        fromAnchor: {
          view: 0,
          trackId: PGBI_TRACK,
          loc: MHC_MARKED_DELETION,
          fracY: 1,
          dy: -8,
        },
        anchor: { graphNode: HPRC_ALLELE, dx: -30, dy: -30 },
        strokeWidth: 3,
      },
      {
        type: 'text',
        // no length: the graph labels its longer nodes, and a length would read
        // as one
        text: 'the same allele, in the graph',
        // between the legend (top ~120 px) and the drawing (from ~210)
        anchor: {
          selector: '[data-testid="graph-genome-canvas"]',
          alignX: 'right',
          alignY: 'top',
        },
        dx: -20,
        dy: 150,
        textAlign: 'end',
        maxWidth: 340,
        fontSize: 20,
      },
    ],
  },
  {
    mode: 'url',
    name: 'pangenome/hprc_haplotype_launch',
    url: MHC_FORCE_LAUNCH,
    readySelector: GRAPH_DRAWN,
    readyTimeout: 180000,
    viewportWidth: 1100,
    viewportHeight: 1232,
    tooltip: 'hide',
    stages: [
      {
        viewportHeight: 660,
        actions: [
          { type: 'delay', ms: 2000 },
          { type: 'rightclick', anchor: { graphNode: HPRC_ALLELE } },
          { type: 'waitForText', text: `Open in ${HAPLOTYPE}` },
        ],
        annotations: [
          {
            type: 'circle',
            anchor: { graphNode: HPRC_ALLELE },
            radius: 20,
            strokeWidth: 3,
          },
          { type: 'box', anchor: { text: `Open in ${HAPLOTYPE}` } },
        ],
      },
      {
        url: MHC_FORCE_LAUNCH,
        viewportHeight: 930,
        actions: [
          { type: 'delay', ms: 2000 },
          { type: 'rightclick', anchor: { graphNode: HPRC_ALLELE } },
          { type: 'waitForText', text: `Open in ${HAPLOTYPE}` },
          { type: 'click', text: `Open in ${HAPLOTYPE}` },
          {
            type: 'waitForSelector',
            selector: HAPLOTYPE_GENES_READY,
            timeout: 180000,
          },
          ...launchedZoomOut(6),
        ],
        annotations: [
          {
            type: 'circle',
            anchor: { graphNode: HPRC_ALLELE },
            radius: 20,
            strokeWidth: 3,
          },
          {
            type: 'box',
            anchor: {
              view: 1,
              trackId: HAPLOTYPE_GENES_TRACK,
              loc: HAPLOTYPE_ALLELE_LOCUS,
            },
            pad: 4,
          },
          {
            type: 'arrow',
            fromAnchor: { graphNode: HPRC_ALLELE, dy: 22 },
            anchor: {
              view: 1,
              trackId: HAPLOTYPE_GENES_TRACK,
              loc: HAPLOTYPE_ALLELE_LOCUS,
              fracY: 0,
              dy: -6,
            },
            strokeWidth: 3,
          },
        ],
      },
    ],
  },
  {
    mode: 'url',
    name: 'pangenome/hprc_kiv2_copies',
    url: sessionSpec(HOSTED_HPRC_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr6:160,596,000-160,666,000',
          tracks: [
            {
              trackId: 'hg38_ncbiRefSeq_ucsc',
              filter: ['geneLike'],
              displayMode: 'compact',
              height: 40,
            },
            {
              trackId: 'hprc_kiv2_copies_all',
              height: 40,
            },
          ],
        },
      ],
    }),
    viewportWidth: 1400,
    viewportHeight: 1300,
    tooltip: 'hide',
    clicksChange: "open the record's repeat copies view",
    actions: [
      { type: 'waitForAppSettled', timeout: 120000 },
      {
        type: 'rightclick',
        anchor: {
          loc: 'chr6:160,631,000',
          trackId: 'hprc_kiv2_copies_all',
          fracY: 0.2,
        },
      },
      { type: 'waitForText', text: 'Show repeat copies' },
      { type: 'click', text: 'Show repeat copies' },
      {
        type: 'waitForSelector',
        selector: '[data-testid="tandem-repeat-view"]',
      },
      { type: 'delay', ms: 500 },
    ],
  },
  // TRGT's ABCA7 alleles as <CNV:TR> records, from the TandemRepeat plugin's
  // trgt-to-cnv-tr.mjs
  {
    mode: 'url',
    name: 'pangenome/hprc_abca7_tandem_repeat_alleles',
    url: sessionSpec(HOSTED_HPRC_CONFIG, {
      sessionTracks: [
        {
          type: 'VariantTrack',
          trackId: 'hprc_abca7_cnvtr',
          name: 'TRGT alleles at ABCA7 as repeat records, 94 HPRC samples',
          assemblyNames: ['hg38'],
          adapter: {
            type: 'VcfTabixAdapter',
            uri: 'https://jbrowse.org/demos/hprc/hprc_abca7_cnvtr.vcf.gz',
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr19:1,049,000-1,050,500',
          tracks: [
            {
              trackId: 'hprc_abca7_cnvtr',
              height: 40,
            },
          ],
        },
      ],
    }),
    viewportWidth: 1400,
    viewportHeight: 1010,
    // the card alone: the record's view was one 40px row over a blank frame
    crop: { x: 1016, y: 48, width: 384, height: 862 },
    tooltip: 'hide',
    clicksChange: "open the record's repeat copies view",
    actions: [
      { type: 'waitForAppSettled', timeout: 120000 },
      {
        type: 'click',
        anchor: {
          loc: 'chr19:1,049,750',
          trackId: 'hprc_abca7_cnvtr',
          fracY: 0.2,
        },
      },
      {
        type: 'waitForSelector',
        selector: '[data-testid="tandem-repeat-view"]',
      },
      { type: 'delay', ms: 500 },
    ],
  },
  {
    mode: 'url',
    name: 'pangenome/hprc_abca7_repeat_units',
    url: sessionSpec(HOSTED_HPRC_CONFIG, {
      sessionTracks: [ABCA7_VNTR_TRACK],
      views: [abca7View()],
    }),
    readySelector: GRAPH_DRAWN,
    readyTimeout: 240000,
    viewportWidth: 1400,
    viewportHeight: 1065,
    tooltip: 'hide',
    actions: [{ type: 'waitForAppSettled', timeout: 180000 }],
  },
  {
    mode: 'url',
    name: 'pangenome/hprc_abca7_disagreements',
    url: sessionSpec(HOSTED_HPRC_CONFIG, {
      sessionTracks: [ABCA7_VNTR_TRACK],
      views: [
        abca7View({
          genes: false,
          pane: {
            // HG02559's second allele has no spanning read and HG04199's second
            // walk does not span the array, so the view leaves those unscored
            rows: { kept: ABCA7_SAMPLES },
            paneHeight: 360,
          },
        }),
      ],
    }),
    readySelector: GRAPH_DRAWN,
    readyTimeout: 240000,
    viewportWidth: 1400,
    viewportHeight: 745,
    tooltip: 'hide',
    actions: [{ type: 'waitForAppSettled', timeout: 180000 }],
  },

  // Everything is blue: a query on `GRCh38#0#chr6` returns rank 0 only. The
  // lane carries the color jexl of the page's `addtrack` fence.
  {
    mode: 'url' as const,
    name: 'pangenome/prepare_graph_segments',
    url: sessionSpec(HPRC_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: C4_WINDOW,
          tracks: [
            hg38GeneLane(70),
            {
              trackId: SEGMENTS_TRACK,
              type: 'LinearBasicDisplay',
              labels: { name: { show: false }, description: { show: false } },
              // grown to the rows alone, the rank key clipped
              height: 110,
            },
          ],
        },
      ],
    }),
    // content, not the track name the header prints before anything draws
    readyText: 'C4A',
    readyTimeout: 180000,
    // the lane grown to its rows held 404; the fixed 110 px lane takes 50 more
    viewportHeight: 454,
  },
  // gfa-to-tabix paths over FLC: one lane per accession, each block its
  // allele at a bubble, colored by class from the file's itemRgb.
  {
    mode: 'url',
    name: 'pangenome/prepare_graph_paths',
    url: sessionSpec(
      'https://jbrowse.org/demos/arabidopsis_pangenome/config.json',
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'TAIR10',
            loc: 'Chr5:3,170,000-3,186,000',
            tracks: [
              { trackId: 'TAIR10_genes', height: 70 },
              { trackId: 'arabidopsis_minigraph_paths', height: 560 },
            ],
          },
        ],
      },
    ),
    readyText: 'Tnz-1',
    readySelector: displayPainted('mark-display'),
    readyTimeout: 120000,
    viewportHeight: 890,
  },
  {
    mode: 'url',
    name: 'pangenome/hprc_amylase_walk_rows',
    url: sessionSpec(PORTAL_CONFIG, {
      views: [
        {
          ...AMYLASE_LANES,
          tracks: [
            AMYLASE_LANES.tracks[0]!,
            graphTrack('hprc_v2_1_walk_lanes', {
              layoutMode: 'walkrows',
              color: 'uniform',
              subgraphHaplotypes: PORTAL_LOCI.amylase.lanes,
              // six bars and the key; 380 left a third of the pane blank
              paneHeight: 220,
              // a bar spans the cut, so the cut stays the array's window
              maxRegionBp: cutNear(150_000),
            }),
          ],
        },
      ],
    }),
    readySelector: GRAPH_DRAWN,
    readyTimeout: 240000,
    viewportWidth: 1400,
    viewportHeight: 540,
    tooltip: 'hide',
    actions: [{ type: 'waitForAppSettled', timeout: 180000 }],
  },
  {
    mode: 'url',
    name: 'pangenome/host_your_own',
    url: sessionSpec(PORTAL_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: C4_WINDOW,
          tracks: [
            'hprc_minigraph_bubbles',
            'hprc_bubble_score',
            'hprc_minigraph_alleles',
            // the tutorial's config names no layout; the portal's opens
            // force-directed
            graphTrack(SEGMENTS_TRACK, {
              color: { field: 'position' },
              layoutMode: 'auto',
            }),
          ],
        },
      ],
    }),
    readySelector: GRAPH_DRAWN,
    readyTimeout: 180000,
    viewportHeight: 1080,
    tooltip: 'hide',
  },
]
