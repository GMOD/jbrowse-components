import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// honey bee Amel_HAv3.1 from the GenArk hub; its NCBI RefSeq GFF is the
// annotation the domains were called on (scripts/build_protein_domains.sh)
const HUB = 'https://jbrowse.org/hubs/genark/GCF/003/254/395/GCF_003254395.2'
const ASSEMBLY = 'GCF_003254395.2'

// tutorials/protein_domains.md fences this track
const PFAM_TRACK = {
  type: 'FeatureTrack',
  trackId: 'pfam_domains',
  name: 'Pfam domains',
  assemblyNames: [ASSEMBLY],
  adapter: {
    type: 'BedTabixAdapter',
    uri: 'https://jbrowse.org/demos/protein_domains/pfam.bed.gz',
  },
  displays: [
    {
      type: 'LinearMultiRowFeatureDisplay',
      displayId: 'pfam_domains-LinearMultiRowFeatureDisplay',
      rows: 'transcript',
      marks: [
        { mark: { type: 'rect', height: { band: 0 } } },
        {
          mark: { type: 'rect', height: { band: 0.7 } },
          transform: [{ type: 'flatten', keepEmpty: true }],
        },
      ],
      encoding: {
        color: { field: 'name', legend: { title: 'Pfam family' } },
      },
    },
  ],
}

export const proteinDomainsSpecs: ScreenshotSpec[] = [
  // vav's four isoforms, one of them skipping the exon that encodes CH
  {
    mode: 'url',
    name: 'protein_domains/vav',
    url: sessionSpec(`${HUB}/config.json`, {
      sessionTracks: [PFAM_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: ASSEMBLY,
          loc: 'NC_037640.1:1,971,400-1,976,800',
          tracks: [
            {
              trackId: `${ASSEMBLY}-ncbiGff`,
              height: 170,
              subfeatureLabels: 'below',
            },
            {
              trackId: 'pfam_domains',
              height: 120,
            },
          ],
        },
      ],
    }),
    readyText: 'Pfam family',
    readyTimeout: 60000,
    viewportWidth: 1200,
    viewportHeight: 520,
  },
]
