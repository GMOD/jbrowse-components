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

import type { LinearSyntenyDisplayModel } from './model.ts'
import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'

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
        const connectedViews = [connected.v0, connected.v1]

        // Tracked deps that SHOULD trigger refetch when changed:
        //   - displayedRegions (per view) — region set drives cumBp output
        //   - adapterConfig and CIGAR drawing options
        //   - a log2 bucket of bpPerPx (per view) — the worker's viewport
        //     cull is sized in px at fetch-time, so zooming out by ~2x
        //     leaves features missing beyond the previous cull window.
        //     Bucketing on log2 avoids refetching on smooth scroll-zoom
        //     bursts within the same half-decade.
        // Not tracked: raw `bpPerPx`, `offsetPx`, `width`,
        // `minimumBlockWidth`. Scroll moves are
        // absorbed by the worker's 50% px buffer.
        for (const v of connectedViews) {
          void v.displayedRegions
          void Math.floor(Math.log2(Math.max(v.bpPerPx, 1)))
        }
        const adapterConfig = self.adapterConfig
        const {
          drawCIGAR,
          drawCIGARMatchesOnly,
          drawLocationMarkers,
          lodMode,
        } = view
        // Untracked reads: values for the worker. Reading these inside
        // `untracked` prevents them from registering as autorun deps, so
        // scroll/zoom changes don't refire the fetch. The worker still
        // sees the *current* offsetPx/bpPerPx for the cull at fetch time.
        const rawSnaps = untracked(() =>
          connectedViews.map(v => ({
            bpPerPx: v.bpPerPx,
            offsetPx: v.offsetPx,
            displayedRegions: v.displayedRegions,
            minimumBlockWidth: v.minimumBlockWidth,
            width: v.width,
          })),
        )

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
          const renameSnap = async (snap: (typeof rawSnaps)[number]) => ({
            ...snap,
            displayedRegions: await renameRegionsForAdapter({
              assemblyManager,
              sessionId,
              adapterConfig,
              regions: snap.displayedRegions,
            }),
          })
          const result = await getSession(self).rpcManager.call(
            sessionId,
            'SyntenyGetFeaturesAndPositions',
            {
              adapterConfig,
              queryView: await renameSnap(rawSnaps[0]!),
              targetView: await renameSnap(rawSnaps[1]!),
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
          self.setRpcData(featureData, instanceData)
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
