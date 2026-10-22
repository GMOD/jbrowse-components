import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// honey bee Amel_HAv3.1 from the GenArk hub; its NCBI RefSeq GFF is the
// annotation the domains were called on (scripts/build_protein_domains.sh)
const CONFIG =
  'https://jbrowse.org/hubs/genark/GCF/003/254/395/GCF_003254395.2/config.json'
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
    disableGeneHeuristic: true,
  },
  displayDefaults: {
    color: { field: 'name' },
  },
}

export const proteinDomainsSpecs: ScreenshotSpec[] = [
  // vav's four isoforms, the top one skipping the exon that encodes CH
  {
    mode: 'url',
    name: 'protein_domains/vav',
    url: sessionSpec(CONFIG, {
      sessionTracks: [PFAM_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: ASSEMBLY,
          loc: 'NC_037640.1:1,971,400-1,976,800',
          tracks: [
            { trackId: 'GCF_003254395.2-ncbiGff', height: 120 },
            { trackId: 'pfam_domains', height: 160 },
          ],
        },
      ],
    }),
    readyText: 'Pfam domains',
    readyTimeout: 60000,
    viewportWidth: 1200,
    viewportHeight: 540,
  },
]
