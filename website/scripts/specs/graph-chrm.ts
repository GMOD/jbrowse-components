// The mitochondrial chromosome of HPRC release 2's pggb graph, for
// pangenome_chrm: one site read as a graph, then every site as a haplotype
// matrix clustered into lineages (scripts/build_chrm_graph.sh).
import { sessionSpec } from '../screenshot-spec-helpers.ts'
import { TOOLBAR_READY } from './graph-fixtures.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

const CHRM_CONFIG = 'test_data/chrm/config.json'
const CHRM_TRACK = 'hprc_chrM_graph_variants'
const DELETION_WINDOW = 'chrM:8,255-8,300'
const DENDROGRAM = '[data-testid="tree_sidebar_dendrogram"]'

// 200 bp around the 9 bp COII/tRNA-Lys deletion with all 234 haplotypes,
// colored by how many of them carry each node, so the bypass reads as the
// minority route.
const deletionGraphSpec: ScreenshotSpec = {
  mode: 'url',
  name: 'pangenome/chrm_deletion_graph',
  url: sessionSpec(CHRM_CONFIG, {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'hg38',
        loc: 'chrM:8,200-8,400',
        tracks: ['hg38_ncbiRefSeq_ucsc'],
      },
      {
        type: 'GraphGenomeView',
        displayName: 'chrM 8,200-8,400, all 234 haplotypes',
        gfaLocation: { uri: 'test_data/chrm/chrM_window.gfa' },
        layoutMode: 'force',
        referencePath: 'GRCh38',
        colorScheme: 'depth',
        bubbleSpread: 'open',
        paneHeight: 420,
      },
    ],
  }),
  readySelector: TOOLBAR_READY,
  readyTimeout: 120000,
  viewportWidth: 1400,
  viewportHeight: 700,
}

// The same site as a haplotype matrix, rows grouped by 1000 Genomes
// superpopulation: the deletion's rows sit in the East Asian and admixed
// American groups, and the South Asian group holds none.
const deletionMatrixSpec: ScreenshotSpec = {
  mode: 'url',
  name: 'pangenome/chrm_deletion_matrix',
  url: sessionSpec(CHRM_CONFIG, {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'hg38',
        loc: DELETION_WINDOW,
        tracks: [
          'hg38_ncbiRefSeq_ucsc',
          {
            trackId: CHRM_TRACK,
            type: 'LinearMultiSampleVariantDisplay',
            height: 520,
            renderingMode: 'phased',
            facet: {
              field: 'superpopulation',
              domain: ['AFR', 'EUR', 'SAS', 'EAS', 'AMR', 'other'],
            },
            rowColor: 'superpopulation',
          },
        ],
      },
    ],
  }),
  readyText: 'chrM',
  readyTimeout: 120000,
  viewportHeight: 860,
}

// The whole chromosome clustered by genotype, rows colored by the branch of
// the mitochondrial tree Haplogrep put each haplotype on. The clusters come out
// as single-color blocks, the African L branches splitting off first.
const lineageClustersSpec: ScreenshotSpec = {
  mode: 'url',
  name: 'pangenome/chrm_lineage_clusters',
  url: sessionSpec(CHRM_CONFIG, {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'hg38',
        loc: 'chrM:1-16,569',
        tracks: [
          {
            trackId: CHRM_TRACK,
            type: 'LinearMultiSampleVariantDisplay',
            height: 620,
            runClustering: true,
            rowColor: 'branch',
          },
        ],
      },
    ],
  }),
  readyText: 'chrM',
  readySelector: DENDROGRAM,
  readyTimeout: 180000,
  viewportHeight: 860,
}

export const graphChrmSpecs: ScreenshotSpec[] = [
  deletionGraphSpec,
  deletionMatrixSpec,
  lineageClustersSpec,
]
