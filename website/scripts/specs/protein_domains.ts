import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// honey bee Amel_HAv3.1 from the GenArk hub; its NCBI RefSeq GFF is the
// annotation the domains were called on (scripts/build_protein_domains.sh)
const CONFIG =
  'https://jbrowse.org/hubs/genark/GCF/003/254/395/GCF_003254395.2/config.json'
const ASSEMBLY = 'GCF_003254395.2'
const GENES = 'GCF_003254395.2-ncbiGff'

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
    rows: { field: 'transcript' },
  },
}

// vav: four isoforms, the first exon of X3 skipping the CH domain
const VAV = 'NC_037640.1:1,971,400-1,976,800'

export const proteinDomainsSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'protein_domains/vav',
    url: sessionSpec(CONFIG, {
      sessionTracks: [PFAM_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: ASSEMBLY,
          loc: VAV,
          tracks: [
            { trackId: GENES, height: 130 },
            { trackId: 'pfam_domains', height: 260 },
          ],
        },
      ],
    }),
    readyText: 'Pfam domains',
    readyTimeout: 60000,
    viewportWidth: 1200,
    viewportHeight: 620,
  },
  {
    mode: 'url',
    name: 'protein_domains/vav_rows',
    url: sessionSpec(CONFIG, {
      sessionTracks: [PFAM_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: ASSEMBLY,
          loc: VAV,
          tracks: [
            { trackId: GENES, height: 130 },
            {
              trackId: 'pfam_domains',
              type: 'LinearMultiRowFeatureDisplay',
            },
          ],
        },
      ],
    }),
    readyText: 'Pfam domains',
    readyTimeout: 60000,
    viewportWidth: 1200,
    viewportHeight: 520,
  },
]
