// The JBrowse 2 v5 paper's Figure 3, which the paper repo syncs from
// figures.lock. The compose needs both parts at one viewportWidth.
import { displaySettled } from '@jbrowse/browser-test-utils'

import { PARK_CURSOR, sessionSpec } from '../screenshot-spec-helpers.ts'
import { CLUSTERED_READY, CNV_CONFIG, CN_HEATMAP_SETTINGS } from './cnv1000g.ts'
import { SORT_BY_GENOTYPE } from './ui.ts'

import type { Annotation, ScreenshotSpec } from '../screenshot-spec-types.ts'

const CONFIG_1000G = encodeURIComponent(
  'https://jbrowse.org/demos/1000g/config.json',
)
const SV_TRACK = {
  type: 'VariantTrack',
  trackId: 'kgp3202_sv',
  name: '1000 Genomes short-read structural variants, 5 kb and longer',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://jbrowse.org/demos/1000g/1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf.gz',
  },
}
const WIDTH = 1500

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
// one nested in it, which the callset does not record and panel b shows
const OUTER_DELETION_SORT_POINT = 'chr3:162,880,000'

const partLabel = (part: number, text: string): Annotation => ({
  type: 'text',
  text,
  fontSize: 44,
  anchor: {
    selector: `[data-part="${part}"]`,
    alignX: 'left',
    alignY: 'top',
    dx: 40,
    dy: 64,
  },
})

export const paperCohortSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'paper/cohort_sv_multisample',
    url: sessionSpec(CONFIG_1000G, {
      sessionTracks: [SV_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: NESTED_DELETION_WINDOW,
          tracks: [
            {
              trackId: SV_TRACK.trackId,
              type: 'LinearMultiSampleVariantDisplay',
              forceLoad: true,
              filter: ['jexl:alleleLength(feature)>=5000'],
              color: { field: 'svType' },
              height: 360,
            },
          ],
        },
      ],
    }),
    readySelector: displaySettled('variant-display'),
    readyTimeout: 300000,
    viewportWidth: WIDTH,
    viewportHeight: 585,
    hideTooltip: true,
    actions: [
      {
        type: 'rightclick',
        anchor: {
          track: SV_TRACK.trackId,
          locus: OUTER_DELETION_SORT_POINT,
          fracY: 0.5,
        },
      },
      { type: 'waitForText', text: SORT_BY_GENOTYPE },
      { type: 'click', text: SORT_BY_GENOTYPE },
      { type: 'delay', ms: 6000 },
      PARK_CURSOR,
      { type: 'delay', ms: 800 },
    ],
  },
  {
    mode: 'url',
    name: 'paper/cohort_cnv',
    url: sessionSpec(CNV_CONFIG, {
      sessionTracks: [HGSVC3_SV_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: NESTED_DELETION_WINDOW,
          tracks: [
            {
              trackId: HGSVC3_SV_TRACK.trackId,
              type: 'LinearVariantDisplay',
              filter: ['jexl:alleleLength(feature)>=5000'],
              displayMode: 'compact',
              height: 90,
            },
            {
              ...CN_HEATMAP_SETTINGS,
              trackId: 'cnv_1000g_zarr',
              height: 370,
              runClustering: true,
              showTree: false,
              showRowLabels: false,
            },
          ],
        },
      ],
    }),
    readySelector: CLUSTERED_READY,
    readyTimeout: 300000,
    viewportWidth: WIDTH,
    viewportHeight: 712,
    diffThreshold: 0.02,
  },
  {
    mode: 'compose',
    name: 'paper/cohort_views',
    parts: ['paper/cohort_sv_multisample', 'paper/cohort_cnv'],
    gutter: 40,
    annotations: [partLabel(0, 'a'), partLabel(1, 'b')],
  },
]
