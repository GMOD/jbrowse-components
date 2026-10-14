import { scoreAdapterFields } from '../GWASAdapter/configSchema.ts'
import { LD_MARKS } from '../LinearManhattanDisplay/ldPlot.ts'
import {
  buildLdAdapterConfig,
  isTabixLocation,
  needsExplicitIndex,
  tabixIndex,
} from './ldAdapterConfig.ts'

import type { FileLocation } from '@jbrowse/core/util/types'

export function requiredIndexes(
  gwasLocation: FileLocation | undefined,
  ldLocation: FileLocation | undefined,
) {
  return {
    gwas: !!gwasLocation && needsExplicitIndex(gwasLocation),
    ld:
      !!ldLocation &&
      isTabixLocation(ldLocation) &&
      needsExplicitIndex(ldLocation),
  }
}

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
  const required = requiredIndexes(gwasLocation, ldLocation)
  return (
    !!gwasLocation &&
    (!required.gwas || !!gwasIndexLocation) &&
    (!required.ld || !!ldIndexLocation) &&
    trackName.trim().length > 0 &&
    !!assembly
  )
}

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
      index: tabixIndex(gwasLocation, gwasIndexLocation),
      ...scoreAdapterFields({ scoreColumn, scoreTransform }),
      ...(ldLocation
        ? { ldAdapter: buildLdAdapterConfig(ldLocation, ldIndexLocation) }
        : {}),
    },
    ...(ldLocation
      ? {
          displays: [
            {
              type: 'LinearManhattanDisplay',
              marks: LD_MARKS,
            },
          ],
        }
      : {}),
  }
}
