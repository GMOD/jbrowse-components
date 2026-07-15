import {
  buildLdAdapterConfig,
  deriveTbiLocation,
  isTabixLocation,
  needsExplicitIndex,
} from './ldAdapterConfig.ts'

import type { FileLocation } from '@jbrowse/core/util/types'

// A GWAS file is always a tabix BED, so an upload with no derivable `.tbi`
// (blob/file-handle) must carry an explicit index; the LD file only when it's
// the bgzipped (.gz) variant.
export function canSubmit({
  gwasLocation,
  gwasIndexLocation,
  ldLocation,
  ldIndexLocation,
  trackName,
  assembly,
}: {
  gwasLocation: FileLocation | undefined
  gwasIndexLocation: FileLocation | undefined
  ldLocation: FileLocation | undefined
  ldIndexLocation: FileLocation | undefined
  trackName: string
  assembly: string | undefined
}) {
  const gwasOk =
    !!gwasLocation && (!needsExplicitIndex(gwasLocation) || !!gwasIndexLocation)
  const ldOk =
    !ldLocation ||
    !isTabixLocation(ldLocation) ||
    !needsExplicitIndex(ldLocation) ||
    !!ldIndexLocation
  return gwasOk && ldOk && trackName.trim().length > 0 && !!assembly
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
      // LD is a second data source nested on the adapter (like MAF's
      // annotationAdapter); the Manhattan display reads it for colorBy 'ld'.
      ...(ldLocation
        ? { ldAdapter: buildLdAdapterConfig(ldLocation, ldIndexLocation) }
        : {}),
    },
    ...(ldLocation
      ? {
          displays: [
            {
              type: 'LinearManhattanDisplay',
              colorBy: 'ld',
            },
          ],
        }
      : {}),
  }
}
