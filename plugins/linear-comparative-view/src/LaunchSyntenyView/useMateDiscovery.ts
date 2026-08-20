import { useEffect, useState } from 'react'

import { createStatusWindow, isAbortException } from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'

import { toPanelRows } from './panelOrder.ts'

import type { MateDiscovery } from './discoverMates.ts'
import type { PanelRow } from './panelOrder.ts'
import type { Region, RpcStatus } from '@jbrowse/core/util'

/**
 * The panel list for one synteny dataset: which assemblies align to `region`,
 * seeded into state the user then owns.
 *
 * Hand-rolled rather than useFetch because of that ownership — they reorder the
 * rows and uncheck them, so this can't be re-derived from `data` every render.
 * `discoverMatesFor` is stable (queueDialog resolves the dialog's props once, at
 * the point the menu item was clicked), so this re-runs on the dataset the user
 * picks and nothing else, and the cleanup stops the discovery for the dataset
 * they picked away from. A selection can be a whole chromosome, so that cleanup
 * matters: the token is created and stopped by the same effect, giving it the
 * fetch's lifetime.
 *
 * `rows` is `undefined` while in flight, which is what the caller draws a
 * spinner on — distinct from `[]`, a dataset that reached nothing. `status` is
 * the RPC's own phase, for the caller to say more than "waiting".
 *
 * `retry` re-runs it. What fails here is a fetch over the network, and without
 * one the only way past a blip was to cancel the dialog and find the menu entry
 * again — losing the dataset, order and options chosen before it.
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
  const [rows, setRows] = useState<PanelRow[] | undefined>()
  const [unconfigured, setUnconfigured] = useState<string[]>([])
  const [error, setError] = useState<unknown>()
  const [status, setStatus] = useState<RpcStatus | undefined>()
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const stopToken = createStopToken()
    let alive = true
    setRows(undefined)
    setUnconfigured([])
    setError(undefined)
    setStatus(undefined)
    // guarded and throttled like every other owner of a progress stream: the
    // RPC emits at download granularity and each write re-renders the dialog.
    // One window per effect run, ended with it, so a trailing write cannot
    // outlive the discovery it describes
    const statusWindow = createStatusWindow()
    const statusCallback = statusWindow.sink({
      isCurrent: () => alive,
      write: setStatus,
    })
    discoverMatesFor(trackId)(stopToken, statusCallback)
      .then(result => {
        if (alive) {
          setRows(toPanelRows(region.assemblyName, result.mates))
          setUnconfigured(result.unconfigured)
        }
      })
      .catch((e: unknown) => {
        if (alive && !isAbortException(e)) {
          setError(e)
        }
      })
    return () => {
      alive = false
      stopStopToken(stopToken)
      // the guard already makes a queued write a no-op; the timer behind it
      // would otherwise still stand for up to a window past unmount
      statusWindow.reset()
    }
    // `region` whole rather than its assemblyName: the panels the worker
    // resolves are cut from all four of its fields. Stable for the dialog's life
    // for the same reason `discoverMatesFor` is; `attempt` is what retry moves
  }, [discoverMatesFor, trackId, region, attempt])
  return {
    rows,
    setRows,
    unconfigured,
    error,
    status,
    retry: () => {
      setAttempt(n => n + 1)
    },
  }
}
