// The Dog10K tours.
import { displaySettled } from '@jbrowse/browser-test-utils'

import { dog10kVideoFixtures } from '../specs/dog10k.ts'
import { DENDROGRAM, LOCATION_BOX, trackMenu } from './shared.ts'

import type { VideoSpec } from '../video-spec-types.ts'

const {
  clusterCore: IGF1_CORE,
  drawnWindow: IGF1_WINDOW,
  matrixTrackId: IGF1_MATRIX,
  unclusteredSession: igf1Unclustered,
} = dog10kVideoFixtures
const IGF1_MATRIX_MENU = trackMenu(IGF1_MATRIX)

export const dog10kVideos: VideoSpec[] = [
  // A ROUTE AND A RE-LAYOUT AT ONCE, and the one place in the three Dog10K
  // tutorials where a still is structurally short of the point.
  // dog10k_selection.md's own sentence is the argument for filming it: the page
  // says a session "can say that instead of performing it", because its figure
  // reaches the row order through `clusterRegion` + `runClustering` rather than
  // through the menu. So the page states an ordering it never shows being
  // produced, and the reader is asked to believe that clustering on genotypes
  // alone recovers the size split -- which is the page's result -- from a picture
  // in which the rows were already in that order when the app opened.
  //
  // What the clip adds over the figure is the BEFORE. The rows start in the VCF's
  // order, which is the order the panel was built in, so the swatch column opens
  // as three clean breed blocks; after the run it is interleaved, and the
  // recovery is visible as a change rather than as a claim about a static image.
  //
  // It also performs the page's "cluster on the core, then widen" advice, which
  // is the one instruction on that page a reader cannot check against any figure:
  // both windows look the same afterwards, so a still of either end says nothing
  // about which region the order came from. The tour runs the clustering at
  // IGF1_CORE, then types IGF1_WINDOW into the location box and the order holds,
  // because the display orders rows by name rather than re-deriving from what is
  // in view.
  {
    name: 'dog10k/igf1_cluster_route',
    description:
      'Clustering the IGF1 genotype matrix from the track menu: breed-ordered rows, the run over the differentiated core, and the order holding when the window widens',
    url: igf1Unclustered(IGF1_CORE),
    // The matrix is a fixed 620 px whatever the window, and the tour neither adds
    // a view nor opens a drawer, so unlike the pangenome tours above there is no
    // tallest-state-in-the-middle to size for: the run reports 945px of app at
    // the first frame, the last and its tallest alike, because the dendrogram
    // column arrives beside the rows rather than under them.
    viewportHeight: 960,
    readySelector: displaySettled('variant-matrix-display'),
    readyTimeout: 180000,
    settleMs: 5000,
    steps: [
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      // Two seconds on the opening state before anything is clicked. The whole
      // clip is a before/after and this is the before, which a reader who has
      // already scrolled past the clustered figure needs a moment to register.
      { type: 'delay', ms: 2000 },
      {
        type: 'click',
        selector: IGF1_MATRIX_MENU,
        say: 'Cluster the breeds by genotype',
        hold: 700,
      },
      { type: 'waitForText', text: 'Clustering' },
      { type: 'click', text: 'Clustering', hold: 700 },
      { type: 'waitForText', text: 'Cluster rows by genotype...' },
      { type: 'click', text: 'Cluster rows by genotype...', hold: 900 },
      { type: 'waitForText', text: 'Run clustering' },
      { type: 'click', text: 'Run clustering' },
      // 167 rows over the core's columns, hclust in an RPC worker under a
      // software rasterizer. `cut` because a film of a spinner is not a film of
      // anything, and the camera comes back on the reordered rows.
      {
        type: 'waitForSelector',
        selector: DENDROGRAM,
        timeout: 240000,
        cut: true,
      },
      { type: 'delay', ms: 3000 },
      // The half the figure cannot state: the order was computed on the core and
      // survives the widening, so the block's edges can be read against the gene
      // track without the flank having diluted the columns that found them.
      {
        type: 'type',
        selector: LOCATION_BOX,
        value: IGF1_WINDOW,
        clear: true,
        say: IGF1_WINDOW,
      },
      { type: 'press', key: 'Enter' },
      {
        type: 'waitForSelector',
        selector: displaySettled('variant-matrix-display'),
        timeout: 180000,
        cut: true,
      },
    ],
    tailMs: 3500,
  },
]
