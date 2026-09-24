import { scoreAdapterFields } from '../GWASAdapter/configSchema.ts'
import {
  buildLdAdapterConfig,
  deriveTbiLocation,
  isTabixLocation,
  makeTabixIndex,
  needsExplicitIndex,
} from './ldAdapterConfig.ts'

import type { FileLocation } from '@jbrowse/core/util/types'

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
      index: makeTabixIndex(
        gwasIndexLocation ?? deriveTbiLocation(gwasLocation),
      ),
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
              color: { field: 'ld' },
            },
          ],
        }
      : {}),
  }
}
