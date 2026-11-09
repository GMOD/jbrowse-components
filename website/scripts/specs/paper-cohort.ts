// The JBrowse 2 v5 paper's cohort figure, which the paper repo syncs from
// figures.lock.
import { displaySettled } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'
import { CLUSTERED_READY, CN_HEATMAP_SETTINGS } from './cnv1000g.ts'
import { GRAPH_DRAWN, graphTrack } from './graph-fixtures.ts'

import type {
  Annotation,
  AnnotationAnchor,
  ScreenshotSpec,
} from '../screenshot-spec-types.ts'

const SV_TRACK = {
  type: 'VariantTrack',
  trackId: 'kgp3202_sv',
  name: '1000 Genomes short-read deletions, 5 kb and longer',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://jbrowse.org/demos/1000g/1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf.gz',
  },
}
const CNV_GRAPH_CONFIG = 'test_data/graphgenomeview/hprc_cnv.json'

const NESTED_DELETION_WINDOW = 'chr3:162,650,000-163,050,000'
const HGSVC3_SV_TRACK = {
  type: 'VariantTrack',
  trackId: 'hgsvc3_sv_insdel',
  name: 'HGSVC3 structural variants, 5 kb and longer',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/HGSVC3/release/Variant_Calls/1.0/GRCh38/variants_GRCh38_sv_insdel_sym_HGSVC2024v1.0.vcf.gz',
  },
}

// Inside the callset's 114 kb deletion (HGSV_105993) but outside the 22 kb
// one nested in it, which the callset does not record and the heatmap shows
const OUTER_DELETION_SORT = { refName: 'chr3', pos: 162_879_999 }

const BLURB_FONT = 18
const LETTER_FONT = 26

// Left of the first deletion call, where every track is clear of calls, the
// blurb indented past its panel's letter
const blurbAnchor = (trackId: string, fracY: number): AnnotationAnchor => ({
  trackId,
  loc: 'chr3:162,655,000',
  fracY,
  alignX: 'left',
})

const trackBlurb = (
  trackId: string,
  fracY: number,
  text: string,
): Annotation => ({
  type: 'text',
  text,
  textAlign: 'start',
  fontSize: BLURB_FONT,
  anchor: { ...blurbAnchor(trackId, fracY), dx: 40 },
})

const panelLabel = (
  trackId: string,
  fracY: number,
  text: string,
): Annotation => ({
  type: 'text',
  text,
  fontSize: LETTER_FONT,
  anchor: { ...blurbAnchor(trackId, fracY), dy: LETTER_FONT - BLURB_FONT },
})

export const paperCohortSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'paper/cohort_views',
    url: sessionSpec(CNV_GRAPH_CONFIG, {
      sessionTracks: [SV_TRACK, HGSVC3_SV_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: NESTED_DELETION_WINDOW,
          tracks: [
            {
              trackId: SV_TRACK.trackId,
              forceLoad: true,
              sortRowsBy: OUTER_DELETION_SORT,
              // Deletions only: a 35 Mb duplication at the window's edge and
              // complex calls loaded just outside it put Duplication and
              // Complex in the legend with nothing visible to key
              filter: [
                "jexl:svType(feature)=='DEL' && alleleLength(feature)>=5000",
              ],
              encoding: { color: 'svType' },
              // The key would cover the lane's label at the window's right
              // edge; the paper's caption gives it instead
              legend: { show: false },
              height: 160,
            },
            {
              trackId: HGSVC3_SV_TRACK.trackId,
              filter: ['jexl:alleleLength(feature)>=5000'],
              genotypes: { show: false },
              records: { displayMode: 'compact' },
            },
            {
              ...CN_HEATMAP_SETTINGS,
              trackId: 'cnv_1000g_zarr',
              type: 'LinearWiggleDisplay',
              height: 160,
              runClustering: true,
              rows: { axis: { tree: false, labels: false } },
            },
            graphTrack('hprc_minigraph_segments', {
              layoutMode: 'force',
              paneHeight: 270,
              color: { field: 'position' },
            }),
          ],
        },
      ],
    }),
    readySelector: `body:has(${displaySettled('variant-display')}):has(${CLUSTERED_READY}) ${GRAPH_DRAWN}`,
    readyTimeout: 300000,
    // the paper prints it at its full text width
    viewportWidth: 930,
    viewportHeight: 1000,
    hideSelectors: ['header.MuiAppBar-root'],
    tooltip: 'hide',
    diffThreshold: 0.02,
    annotations: [
      panelLabel(SV_TRACK.trackId, 0.55, 'a'),
      panelLabel('cnv_1000g_zarr', 0.55, 'b'),
      panelLabel('hprc_minigraph_segments', 0.17, 'c'),
      trackBlurb(
        SV_TRACK.trackId,
        0.55,
        '1000 Genomes\nshort-read\ndeletion calls',
      ),
      trackBlurb(
        HGSVC3_SV_TRACK.trackId,
        0.52,
        'HGSVC long-read\nassembly calls',
      ),
      trackBlurb(
        'cnv_1000g_zarr',
        0.55,
        '1000 Genomes\ncopy number\n(QuicK-mer2)',
      ),
      // between the graph's reference strip and its backbone
      trackBlurb('hprc_minigraph_segments', 0.17, 'HPRC v2.1\npangenome graph'),
    ],
  },
]
