import { buildLdAdapterConfig, deriveTbiLocation } from './ldAdapterConfig.ts'

import type { FileLocation } from '@jbrowse/core/util/types'

export function canSubmit({
  gwasLocation,
  trackName,
  assembly,
}: {
  gwasLocation: FileLocation | undefined
  trackName: string
  assembly: string | undefined
}) {
  return !!gwasLocation && trackName.trim().length > 0 && !!assembly
}

// Full GWAS track config. The GWAS data is a bgzipped+tabixed BED
// (GWASAdapter extends BedTabixAdapter → bedGzLocation + index). When an LD
// file is supplied, a LinearManhattanDisplay is configured for LocusZoom-style
// r²-to-index coloring (colorBy 'ld'); the index SNP auto-picks the top hit.
export function buildGwasTrackConfig({
  trackId,
  trackName,
  assembly,
  gwasLocation,
  gwasIndexLocation,
  scoreColumn,
  scoreTransform,
  ldLocation,
  ldIndexLocation,
  displayId,
}: {
  trackId: string
  trackName: string
  assembly: string
  gwasLocation: FileLocation
  gwasIndexLocation: FileLocation | undefined
  scoreColumn: string
  scoreTransform: string
  ldLocation: FileLocation | undefined
  ldIndexLocation: FileLocation | undefined
  displayId: string
}) {
  return {
    trackId,
    type: 'GWASTrack',
    name: trackName,
    assemblyNames: [assembly],
    adapter: {
      type: 'GWASAdapter',
      bedGzLocation: gwasLocation,
      index: {
        indexType: 'TBI',
        location: gwasIndexLocation ?? deriveTbiLocation(gwasLocation),
      },
      scoreColumn,
      // 'none' is the schema default, so omit it to keep the genome-wide
      // (already -log10) adapter config minimal; only a raw/ln p-value column
      // needs the transform baked in.
      ...(scoreTransform === 'none' ? {} : { scoreTransform }),
    },
    ...(ldLocation
      ? {
          displays: [
            {
              type: 'LinearManhattanDisplay',
              displayId,
              colorBy: 'ld',
              ldAdapter: buildLdAdapterConfig(ldLocation, ldIndexLocation),
            },
          ],
        }
      : {}),
  }
}
