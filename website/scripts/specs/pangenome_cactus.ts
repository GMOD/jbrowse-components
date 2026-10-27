import { displayPainted } from '@jbrowse/browser-test-utils'

import {
  PARK_CURSOR,
  displayReady,
  sessionSpec,
} from '../screenshot-spec-helpers.ts'
import {
  ECOLI_AVA_STACK_HEIGHT,
  ECOLI_DEMO_BASE,
  ecoliAvaStack,
  ecoliPageTrack,
} from './demoBase.ts'
import {
  STRAINS_PER_SEGMENT_DISPLAY,
  GRAPH_DRAWN,
  cutNear,
  graphTrack,
  local,
} from './graph-fixtures.ts'
import { pageFenceText } from './pageTrack.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// ECOLI_DEMO_BASE lets a rebuilt but not yet uploaded demo render these too.
const CONFIG = `${ECOLI_DEMO_BASE}/config.json`

// The graph figure loads a fixture so a demo config edit cannot change it.
// After a demo redeploy, render it once with CONFIG and no session tracks to
// check the reader's path.
const GRAPH_CONFIG = local('test_data/graphgenomeview/config.json')

const CACTUS_DOC = 'tutorials/pangenome_cactus.md'
const MC_SEGMENTS_TRACK = 'ecoli_cactus_segments'
const MC_SEGMENTS_SESSION_TRACK = ecoliPageTrack(CACTUS_DOC, MC_SEGMENTS_TRACK)

// A view shows a track once, so the carriage lane needs its own trackId.
const MC_CARRIAGE_TRACK = 'ecoli_cactus_carriage'
const MC_CARRIAGE_SESSION_TRACK = {
  type: 'FeatureTrack',
  trackId: MC_CARRIAGE_TRACK,
  name: 'MC graph: strains per segment',
  assemblyNames: MC_SEGMENTS_SESSION_TRACK.assemblyNames,
  adapter: MC_SEGMENTS_SESSION_TRACK.adapter,
}

const MC_MAF_TRACK = 'ecoli_cactus_maf'
const MC_MAF_SESSION_TRACK = ecoliPageTrack(CACTUS_DOC, MC_MAF_TRACK)

const K12_GENES_SESSION_TRACK = {
  type: 'FeatureTrack',
  trackId: 'K12_genes',
  name: 'K12 genes',
  assemblyNames: ['K12'],
  adapter: {
    type: 'Gff3TabixAdapter',
    gffGzLocation: { uri: `${ECOLI_DEMO_BASE}/K12.gff.gz` },
    index: { location: { uri: `${ECOLI_DEMO_BASE}/K12.gff.gz.tbi` } },
  },
}

// Segment 258914 (chr:1,978,494-1,979,270) is K12-only, and both its anchors
// sit inside this window, so the bubble closes in frame.
const IS1_WINDOW = 'chr:1,978,100-1,979,700'
const IS1_HIGHLIGHT = {
  refName: 'chr',
  start: 1978494,
  end: 1979270,
  color: 'rgba(214,137,16,0.13)',
}

// Sampled from graph.png in its row order. K12 is the view's axis, not a row.
const ODGI_PATH_COLORS = [
  { name: 'CFT073', color: 'rgb(163,68,151)' },
  { name: 'IAI39', color: 'rgb(114,190,79)' },
  { name: 'NCTC86', color: 'rgb(200,132,51)' },
  { name: 'Sakai', color: 'rgb(164,163,56)' },
]

export const pangenomeCactusSpecs: ScreenshotSpec[] = [
  // Genes grey: at the default goldenrod they read as graph nodes. An anchored
  // layout draws the private arm flat against the backbone.
  {
    mode: 'url',
    name: 'pangenome_cactus/graph_bubble',
    url: sessionSpec(GRAPH_CONFIG, {
      sessionTracks: [
        K12_GENES_SESSION_TRACK,
        MC_SEGMENTS_SESSION_TRACK,
        MC_CARRIAGE_SESSION_TRACK,
        MC_MAF_SESSION_TRACK,
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: IS1_WINDOW,
          highlight: [IS1_HIGHLIGHT],
          tracks: [
            {
              trackId: 'K12_genes',
              height: 60,
              encoding: { color: { value: 'rgb(130,130,130)' } },
              // Drops the IS1's unnamed record, which draws as the widest box.
              filter: ["jexl:feature.type=='gene'"],
            },
            {
              trackId: MC_CARRIAGE_TRACK,
              type: 'LinearBasicDisplay',
              displayMode: 'collapsed',
              // The five-entry legend needs this height.
              height: 150,
              ...STRAINS_PER_SEGMENT_DISPLAY,
            },
            { trackId: MC_MAF_TRACK, height: 130 },
            graphTrack(MC_SEGMENTS_TRACK, {
              layoutMode: 'force',
              // 600 leaves 330 px blank above the drawing; 320 pushes the
              // callout past the frame's bottom.
              paneHeight: 400,
              color: { field: 'position' },
              // On, bubbles draw a SNP halo on every backbone joint.
              layers: { bubbles: false },
              // Wider braids the drawing.
              maxRegionBp: cutNear(1600),
            }),
          ],
        },
      ],
    }),
    readySelector: GRAPH_DRAWN,
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 1070,
    tooltip: 'hide',
    annotations: [
      {
        type: 'text',
        text: 'the other four strains skip this node',
        fontSize: 18,
        leader: true,
        anchor: { graphNode: '258914' },
        dx: 120,
        dy: 70,
      },
    ],
  },

  {
    mode: 'url',
    name: 'pangenome_cactus/synteny',
    url: sessionSpec(CONFIG, {
      views: [
        {
          ...ecoliAvaStack('ecoli_cactus_ava'),
          encoding: { color: { field: 'strand' } },
        },
      ],
    }),
    viewportHeight: ECOLI_AVA_STACK_HEIGHT,
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
  },

  // One multiwiggle so both builders share an axis. Session tracks skip the
  // config's baseUri, so their URIs are absolute.
  {
    mode: 'url',
    name: 'pangenome_cactus/builders',
    url: sessionSpec(CONFIG, {
      sessionTracks: [
        {
          type: 'MultiQuantitativeTrack',
          trackId: 'ecoli_depth_by_builder',
          name: 'Pangenome depth over K12, by builder (odgi depth)',
          assemblyNames: ['K12'],
          adapter: {
            type: 'MultiWiggleAdapter',
            subadapters: [
              {
                type: 'BigWigAdapter',
                name: 'pggb',
                bigWigLocation: {
                  uri: `${ECOLI_DEMO_BASE}/ecoli_pggb_depth.bw`,
                  locationType: 'UriLocation',
                },
              },
              {
                type: 'BigWigAdapter',
                name: 'Minigraph-Cactus',
                bigWigLocation: {
                  uri: `${ECOLI_DEMO_BASE}/ecoli_cactus_depth.bw`,
                  locationType: 'UriLocation',
                },
              },
            ],
          },
          displays: [
            {
              type: 'LinearWiggleDisplay',
              displayId: 'ecoli_depth_by_builder-display',
              // Autoscale fits each row to its own max and erases the doubling.
              encoding: { y: { scale: { domainMin: 0, domainMax: 10 } } },
            },
          ],
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:3,935,000-3,955,000',
          highlight: [
            {
              refName: 'chr',
              start: 3941447,
              end: 3946786,
              assemblyName: 'K12',
              label: 'rrnC operon: the copies pggb collapses',
            },
          ],
          tracks: [
            { trackId: 'K12_genes' },
            {
              trackId: 'ecoli_depth_by_builder',
              height: 300,
            },
          ],
        },
      ],
    }),
    readySelector: displayReady('wiggle-display'),
    readyTimeout: 90000,
    // At 1000 the callout pills start on top of the plateau.
    viewportWidth: 1200,
    // 640 puts the bottom row's 0 tick on the frame edge.
    viewportHeight: 690,
    tooltip: 'hide',
    actions: [PARK_CURSOR],
    // Both pills sit over the flat right flank, where an opaque pill covers no
    // shape. fracY is a fraction of the whole two-row track.
    annotations: [
      {
        type: 'text',
        text: 'seqwish collapses the copies onto one run of nodes',
        maxWidth: 430,
        fontSize: 16,
        textAlign: 'end',
        anchor: {
          trackId: 'ecoli_depth_by_builder',
          loc: 'chr:3,954,300',
          fracY: 0.12,
        },
      },
      {
        type: 'text',
        text: 'Minigraph-Cactus keeps the copies apart',
        maxWidth: 430,
        fontSize: 16,
        textAlign: 'end',
        anchor: {
          trackId: 'ecoli_depth_by_builder',
          loc: 'chr:3,954,300',
          fracY: 0.62,
        },
      },
    ],
  },

  // The window needs rows that drop out; on shared backbone every row is solid.
  {
    mode: 'url',
    name: 'pangenome_cactus/maf',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:2,554,007-2,570,007',
          tracks: [
            { trackId: 'K12_genes' },
            {
              trackId: 'ecoli_cactus_maf',
              height: 130,
            },
          ],
        },
      ],
    }),
    readyText: '2,570,007',
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 480,
    tooltip: 'hide',
    actions: [PARK_CURSOR],
  },

  // chr:1,000,000-1,100,000 is the 100 kb K12 window spanning the most
  // pangenome sequence in the pinned graph (build_ecoli_pangenome_cactus.sh).
  {
    mode: 'url',
    name: 'pangenome_cactus/graph_correspondence',
    url: sessionSpec(CONFIG, {
      sessionTracks: [
        {
          type: 'MultiQuantitativeTrack',
          trackId: 'ecoli_cactus_pav_odgi_colors',
          name: 'MC graph: per-strain presence (odgi pav, vs K12)',
          assemblyNames: ['K12'],
          adapter: {
            type: 'MultiWiggleAdapter',
            subadapters: ODGI_PATH_COLORS.map(({ name, color }) => ({
              type: 'BigWigAdapter',
              name,
              color,
              bigWigLocation: {
                uri: `https://jbrowse.org/demos/ecoli_pangenome/ecoli_cactus_pav_${name}.bw`,
                locationType: 'UriLocation',
              },
            })),
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:1-4,641,652',
          highlight: [
            // getHighlightColor uses a supplied color as-is, so gold needs alpha.
            {
              refName: 'chr',
              start: 1000000,
              end: 1100000,
              color: 'rgba(255,193,7,0.60)',
            },
          ],
          tracks: [
            {
              trackId: 'ecoli_cactus_pav_odgi_colors',
              // A 0-1 domain keeps every present base fully saturated.
              mark: 'rect',
              encoding: { y: { scale: { domainMin: 0, domainMax: 1 } } },
              // The raster's 40px per row.
              height: 160,
            },
          ],
        },
      ],
    }),
    readyText: 'per-strain presence',
    readyTimeout: 90000,
    // 1040 CSS px captures at 2080, the odgi raster's width.
    viewportWidth: 1040,
    viewportHeight: 380,
    tooltip: 'hide',
    actions: [PARK_CURSOR],
  },
]

// What the subgraph tour types into the paste box.
export const CACTUS_SEGMENTS_TRACK_JSON = pageFenceText(
  CACTUS_DOC,
  MC_SEGMENTS_TRACK,
)

const CACTUS_TOUR_WINDOW = 'chr:1,972,900-1,984,900'

// What website/scripts/videos/pangenome.ts films.
export const cactusVideoFixtures = {
  config: GRAPH_CONFIG,
  genesTrack: K12_GENES_SESSION_TRACK,
  segmentsTrackId: MC_SEGMENTS_TRACK,
  segmentsTrackJson: CACTUS_SEGMENTS_TRACK_JSON,
  tourWindow: CACTUS_TOUR_WINDOW,
  locusWindow: IS1_WINDOW,
}
