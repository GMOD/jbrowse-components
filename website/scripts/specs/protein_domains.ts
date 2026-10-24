import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// honey bee Amel_HAv3.1 from the GenArk hub; its NCBI RefSeq GFF is the
// annotation the domains were called on (scripts/build_protein_domains.sh)
const HUB = 'https://jbrowse.org/hubs/genark/GCF/003/254/395/GCF_003254395.2'
const ASSEMBLY = 'GCF_003254395.2'

// tutorials/protein_domains.md fences both tracks
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
}

const GENES_TRACK = {
  type: 'FeatureTrack',
  trackId: 'genes_with_pfam',
  name: 'RefSeq genes with Pfam domains',
  assemblyNames: [ASSEMBLY],
  adapter: {
    type: 'Gff3TabixAdapter',
    uri: `${HUB}/GCF_003254395.2_Amel_HAv3.1_genomic.gff.gz`,
    index: {
      location: {
        uri: `${HUB}/GCF_003254395.2_Amel_HAv3.1_genomic.gff.gz.csi`,
      },
      indexType: 'CSI',
    },
  },
  displayDefaults: {
    proteinFeatures: {
      track: 'pfam_domains',
      color: { field: 'name', legend: { title: 'Pfam family' } },
    },
  },
}

export const proteinDomainsSpecs: ScreenshotSpec[] = [
  // vav's four isoforms, the top one skipping the exon that encodes CH
  {
    mode: 'url',
    name: 'protein_domains/vav',
    url: sessionSpec(`${HUB}/config.json`, {
      sessionTracks: [PFAM_TRACK, GENES_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: ASSEMBLY,
          loc: 'NC_037640.1:1,971,400-1,976,800',
          tracks: [{ trackId: 'genes_with_pfam', height: 160 }],
        },
      ],
    }),
    readyText: 'Pfam family',
    readyTimeout: 60000,
    viewportWidth: 1200,
    viewportHeight: 380,
  },
]
