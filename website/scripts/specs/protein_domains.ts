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
    type: 'Gff3TabixAdapter',
    uri: 'https://jbrowse.org/demos/protein_domains/pfam.gff3.gz',
    csi: true,
  },
  displays: [
    {
      type: 'LinearMultiRowFeatureDisplay',
      displayId: 'pfam_domains-LinearMultiRowFeatureDisplay',
      encoding: {
        color: { field: 'name', legend: { title: 'Pfam family' } },
      },
    },
  ],
}

export const proteinDomainsSpecs: ScreenshotSpec[] = [
  // Su(var)3-9's curated isoforms carry either SET or the eIF2 gamma domains.
  // At 1600 wide the window clears the row labels on the left and the key on
  // the right, and stops short of the next gene's transcript past the key
  {
    mode: 'url',
    name: 'protein_domains/suvar39',
    url: sessionSpec(`${HUB}/config.json`, {
      sessionTracks: [PFAM_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: ASSEMBLY,
          loc: 'NC_037653.1:4,839,300-4,850,050',
          tracks: [{ trackId: 'pfam_domains', height: 225 }],
        },
      ],
    }),
    readyText: 'Pfam family',
    readyTimeout: 60000,
    viewportWidth: 1600,
    viewportHeight: 430,
  },
]
