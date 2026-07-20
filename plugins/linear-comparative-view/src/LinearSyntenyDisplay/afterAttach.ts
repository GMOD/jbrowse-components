import {
  getContainingView,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import {
  createStopTokenRotation,
  detectDisplayAssembliesSwapped,
  renameRegionsForAdapter,
} from '@jbrowse/synteny-core'
import { autorun, untracked } from 'mobx'

import { syntenyFetchRegions } from '../LinearSyntenyRPC/syntenyFetchWindow.ts'

import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'
import type { LinearSyntenyDisplayModel } from './model.ts'
import type { Region } from '@jbrowse/core/util'

// The stop-token rotation + staleness guard come from
// `createStopTokenRotation` (shared with dotplot-view's fetch); only the
// synteny-specific guards, tracked deps, RPC args, and result handling live
// here.
export function doAfterAttach(self: LinearSyntenyDisplayModel) {
  const fetch = createStopTokenRotation(self)

  addDisposer(
    self,
    autorun(
      async function syntenyFetchAutorun() {
        if (self.isMinimized) {
          return
        }
        // A synteny level draws between two adjacent genome views; this display
        // only depends on those two, not the whole stack. connectedViews is the
        // shared gate (same one renderParams uses).
        const view = getContainingView(self) as LinearSyntenyViewModel
        const connected = self.connectedViews
        if (!connected) {
          return
        }
        const { v0, v1 } = connected
        const connectedViews = [v0, v1]

        // Tracked deps that SHOULD trigger refetch when changed:
        //   - displayedRegions (per view) — region set drives cumBp output
        //   - adapterConfig and CIGAR drawing options
        //   - fetchRegionsKey — the snapped visible window + pan buffer of both
        //     views. Scoping the indexed fetch to this makes scroll/zoom past
        //     the buffer refetch the newly-visible slice; sub-buffer pans keep
        //     the same snapped window so the computed doesn't refire.
        //   - bpPerPxBucketKey — the log2 zoom bucket of both views. Still
        //     needed for the small-region case, where fetchRegions is clamped
        //     to the whole (zoom-independent) region: without this, zooming out
        //     would not refetch and the worker's stale px cull would leave
        //     newly-visible features unemitted.
        // Not tracked: raw `bpPerPx`, `offsetPx`, `width`.
        // Sub-buffer scroll moves are absorbed by the worker's px buffer.
        for (const v of connectedViews) {
          void v.displayedRegions
        }
        void self.fetchRegionsKey
        void self.bpPerPxBucketKey
        const adapterConfig = self.adapterConfig
        const {
          drawCIGAR,
          drawCIGARMatchesOnly,
          drawLocationMarkers,
          lodMode,
        } = view
        // Snapshot the fetch-input signature now, from the same tracked inputs
        // this fetch depends on, so the resulting data is tagged with what it
        // was fetched for even if the view changes again mid-RPC.
        const fetchKey = self.currentFetchKey
        // Untracked reads: values for the worker's fetch-time cull. Reading
        // these inside `untracked` prevents them from registering as autorun
        // deps, so scroll/zoom changes don't refire the fetch (fetchRegionsKey/
        // bpPerPxBucketKey above decide that); the worker still sees the
        // *current* offsetPx/bpPerPx.
        //
        // Query axis (v0) drives the scoped single-axis fetch, so it alone
        // carries the visible window + pan buffer and the cull width.
        const rawQuery = untracked(() => ({
          bpPerPx: v0.bpPerPx,
          offsetPx: v0.offsetPx,
          displayedRegions: v0.displayedRegions,
          width: v0.width,
          fetchRegions: syntenyFetchRegions({
            visibleRegions: v0.visibleRegions,
            displayedRegions: v0.displayedRegions,
            width: v0.width,
            bpPerPx: v0.bpPerPx,
          }),
        }))
        // Target axis (v1) only supplies its cumBp index + cull geometry.
        const rawTarget = untracked(() => ({
          bpPerPx: v1.bpPerPx,
          offsetPx: v1.offsetPx,
          displayedRegions: v1.displayedRegions,
        }))

        const { stopToken, isCurrent, statusCallback } = fetch.begin()
        // Clear any prior error as the new fetch begins, so a stale banner
        // never lingers over freshly-loaded data (mirrors dotplot setLoading).
        self.setError(undefined)
        self.setFetching(true)

        try {
          const sessionId = getRpcSessionId(self)
          // RefName reconciliation (canonical <-> adapter aliases, e.g.
          // "1" <-> "NC_012119.1") happens here on the main thread because the
          // RPC worker has no assemblyManager to resolve aliases.
          // renameRegionsIfNeeded rewrites each region's refName into the
          // synteny adapter's namespace, so the worker's getFeatures query, its
          // cumBp index, and the feature refNames it reads back all line up.
          const { assemblyManager } = getSession(self)
          const renameRegions = (regions: Region[]) =>
            renameRegionsForAdapter({
              assemblyManager,
              sessionId,
              adapterConfig,
              regions,
            })
          // Query axis renames both its displayed regions and its scoped fetch
          // window; the target axis has no fetch window (single-axis fetch), so
          // only its displayed regions are renamed.
          const queryView = {
            ...rawQuery,
            displayedRegions: await renameRegions(rawQuery.displayedRegions),
            fetchRegions: await renameRegions(rawQuery.fetchRegions),
          }
          const targetView = {
            ...rawTarget,
            displayedRegions: await renameRegions(rawTarget.displayedRegions),
          }
          const result = await getSession(self).rpcManager.call(
            sessionId,
            'SyntenyGetFeaturesAndPositions',
            {
              adapterConfig,
              queryView,
              targetView,
              stopToken,
              drawCIGAR,
              drawCIGARMatchesOnly,
              drawLocationMarkers,
              lodMode,
              statusCallback,
            },
          )
          if (!isCurrent()) {
            return
          }
          const { instanceData, ...featureData } = result
          self.setRpcData(featureData, instanceData, fetchKey)
        } catch (e) {
          if (isCurrent() && !isAbortException(e)) {
            console.error(e)
            self.setError(e)
          }
        } finally {
          // Only the current fetch clears these — a superseded fetch resolving
          // late must not unset the flags the newer fetch just set.
          if (isCurrent()) {
            self.setStatusMessage(undefined)
            self.setFetching(false)
          }
        }
      },
      { name: 'SyntenyFetch', delay: 500 },
    ),
  )

  // One-shot at view load: compare the adapter's reported refNames per row
  // against each assembly's full refNames to flag a reversed row order. Runs
  // off the per-render fetch path so it never re-fires (or misfires) on zoom.
  addDisposer(
    self,
    autorun(
      async function syntenyAssemblySwapCheck() {
        if (!isAlive(self)) {
          return
        }
        const view = getContainingView(self) as LinearSyntenyViewModel
        const level = self.level
        if (!view.initialized || level + 1 >= view.views.length) {
          return
        }
        const swapped = await detectDisplayAssembliesSwapped(
          self,
          view.views[level]!.assemblyNames[0],
          view.views[level + 1]!.assemblyNames[0],
        )
        if (isAlive(self)) {
          self.setAssembliesSwapped(swapped)
        }
      },
      { name: 'SyntenyAssemblySwapCheck' },
    ),
  )

  addDisposer(self, () => {
    fetch.dispose()
  })
}
