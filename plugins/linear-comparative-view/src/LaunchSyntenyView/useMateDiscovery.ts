import { useState } from 'react'

import { useFetch } from '@jbrowse/core/util/useFetch'

import { toPanelRows } from './panelOrder.ts'

import type { MateDiscovery } from './discoverMates.ts'
import type { PanelRow } from './panelOrder.ts'
import type { MateDiscoveryResult } from './pickMatesForRegion.ts'
import type { Region } from '@jbrowse/core/util'

/**
 * The panel list for one synteny dataset: which assemblies align to `region`,
 * seeded into rows the user then owns — they reorder and uncheck them. An edit
 * is kept against the discovery it was made on, so a new dataset starts from
 * its own rows and a re-render keeps the user's.
 *
 * `rows` is `undefined` while in flight, and the caller draws a spinner for it.
 * A dataset that reached nothing gives the anchor row alone. `status` is the
 * RPC's own phase, for the caller to say more than "waiting". `retry` re-runs a
 * failed discovery without losing the dataset and options chosen before it.
 */
export function useMateDiscovery({
  discoverMatesFor,
  trackId,
  region,
}: {
  discoverMatesFor: (trackId: string) => MateDiscovery
  trackId: string
  region: Region
}) {
  const { data, error, status, mutate } = useFetch(
    ['mateDiscovery', trackId, region] as const,
    (_key, trackId, _region, signal, statusCallback) =>
      discoverMatesFor(trackId)(signal, statusCallback),
  )
  const [edited, setEdited] = useState<{
    from: MateDiscoveryResult
    rows: PanelRow[]
  }>()
  const rows = data
    ? edited?.from === data
      ? edited.rows
      : toPanelRows(region.assemblyName, data.mates)
    : undefined
  return {
    rows,
    setRows: (rows: PanelRow[]) => {
      if (data) {
        setEdited({ from: data, rows })
      }
    },
    unconfigured: data?.unconfigured ?? [],
    error,
    status,
    retry: mutate,
  }
}
