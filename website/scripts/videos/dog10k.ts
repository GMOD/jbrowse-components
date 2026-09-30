// The Dog10K tours.
import { displaySettled } from '@jbrowse/browser-test-utils'

import { dog10kVideoFixtures } from '../specs/dog10k.ts'
import { DENDROGRAM, trackMenu } from './shared.ts'

import type { VideoSpec } from '../video-spec-types.ts'

const {
  clusterCore: IGF1_CORE,
  matrixTrackId: IGF1_MATRIX,
  unclusteredSession: igf1Unclustered,
} = dog10kVideoFixtures
const MATRIX_SETTLED = displaySettled('variant-matrix-display')

export const dog10kVideos: VideoSpec[] = [
  // The figure reaches its row order through `clusterRegion` + `runClustering`,
  // so the page states an ordering it never shows being produced. The clip's
  // addition is the BEFORE: rows in the panel's build order, then reordered, and
  // then the page's "cluster on the core, then widen" advice, ending on the
  // window the page's haplotype-block figure is of.
  {
    name: 'dog10k/igf1_cluster_route',
    description:
      'Clustering the IGF1 genotype matrix from the track menu: breed-ordered rows, the run over the differentiated core, and the order holding when the view zooms out',
    goal: 'Cluster 167 dogs by IGF1 genotype and see small and giant breeds separate',
    url: igf1Unclustered(IGF1_CORE),
    // the matrix is a fixed 620px and the dendrogram draws beside the rows; the
    // caption chip's strip sits under the app's 951px
    viewportHeight: 1070,
    readySelector: MATRIX_SETTLED,
    readyTimeout: 180000,
    steps: [
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      {
        type: 'delay',
        ms: 2000,
        say: "Rows start in breed order; the left stripe is each dog's size class",
      },
      {
        type: 'click',
        selector: trackMenu(IGF1_MATRIX),
        say: 'Cluster the rows by genotype from the track menu',
        hold: 700,
      },
      { type: 'waitForText', text: 'Clustering' },
      { type: 'click', text: 'Clustering', hold: 700 },
      { type: 'waitForText', text: 'Cluster rows by genotype...' },
      { type: 'click', text: 'Cluster rows by genotype...', hold: 900 },
      { type: 'waitForText', text: 'Run clustering' },
      { type: 'click', text: 'Run clustering' },
      // 167 rows of hclust in an RPC worker
      {
        type: 'waitForSelector',
        selector: DENDROGRAM,
        timeout: 240000,
        cut: true,
      },
      {
        type: 'delay',
        ms: 3000,
        say: 'On genotypes alone, the size classes gather into blocks',
      },
      {
        type: 'click',
        selector: '[data-testid="zoom_out"]',
        say: 'Widen the window to see how far the block runs',
      },
      {
        type: 'waitForSelector',
        selector: MATRIX_SETTLED,
        timeout: 180000,
        cut: true,
      },
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      {
        type: 'delay',
        ms: 3000,
        say: 'Small breeds, orange, share one haplotype across IGF1; most giants lack it',
      },
    ],
    tailMs: 3000,
  },
]
