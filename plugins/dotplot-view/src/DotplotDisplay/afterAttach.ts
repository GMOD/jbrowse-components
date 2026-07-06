import {
  getContainingView,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import {
  coerceColorBy,
  createStopTokenRotation,
  detectDisplayAssembliesSwapped,
  renameRegionsForAdapter,
} from '@jbrowse/synteny-core'
import { autorun, untracked } from 'mobx'

import { createDotplotColorFunction } from './dotplotColors.ts'
import { buildLineSegments } from './dotplotGeometry.ts'

import type { DotplotDisplayModel } from './stateModelFactory.tsx'
import type { Dotplot1DViewModel } from '../DotplotView/1dview.ts'
import type { DotplotViewModel } from '../DotplotView/model.ts'
import type { Region } from '@jbrowse/core/util'
import type { BpIndexViewSnap } from '@jbrowse/synteny-core'

const RPC_DEBOUNCE_MS = 1000

function makeViewSnap(view: Dotplot1DViewModel): BpIndexViewSnap {
  return {
    bpPerPx: view.bpPerPx,
    displayedRegions: view.displayedRegions,
    minimumBlockWidth: view.minimumBlockWidth,
  }
}

// The stop-token rotation + staleness guard come from
// `createStopTokenRotation` (shared with linear-comparative-view's synteny
// fetch); only the dotplot-specific guards, RPC args, and result handling live
// here.
export function doAfterAttach(
  self: Omit<DotplotDisplayModel, 'afterAttach' | 'beforeDestroy'>,
) {
  const fetch = createStopTokenRotation(self)

  addDisposer(
    self,
    autorun(
      async function dotplotFetchAutorun() {
        const view = getContainingView(self) as DotplotViewModel
        if (!view.initialized) {
          return
        }
        const regions = view.hview.dynamicBlocks.contentBlocks
        const { adapterConfig } = self
        const { lodMode } = view
        const hViewSnap = makeViewSnap(view.hview)
        const vViewSnap = makeViewSnap(view.vview)

        const { stopToken, isCurrent, statusCallback } = fetch.begin()
        self.setLoading(stopToken)

        try {
          const sessionId = getRpcSessionId(self)
          // RefName reconciliation (canonical <-> adapter aliases) happens here
          // on the main thread because the RPC worker has no assemblyManager to
          // resolve aliases. Rewrite every region the worker sees into the
          // adapter's namespace so its getFeatures query and cumBp index line up
          // with the feature refNames it reads back. Both the query regions and
          // the h-axis index snap use the h-axis assembly; the v-axis index snap
          // uses the v-axis assembly. renameRegionsForAdapter keys per-region by
          // assemblyName, so one shared call shape covers all three.
          const { assemblyManager } = getSession(self)
          const rename = (rs: Region[]) =>
            renameRegionsForAdapter({
              assemblyManager,
              sessionId,
              adapterConfig,
              regions: rs,
            })
          const result = await getSession(self).rpcManager.call(
            sessionId,
            'DotplotGetFeaturesAndPositions',
            {
              adapterConfig,
              regions: await rename(regions),
              hViewSnap: {
                ...hViewSnap,
                displayedRegions: await rename(hViewSnap.displayedRegions),
              },
              vViewSnap: {
                ...vViewSnap,
                displayedRegions: await rename(vViewSnap.displayedRegions),
              },
              stopToken,
              lodMode,
              statusCallback,
            },
          )
          if (!isCurrent()) {
            return
          }
          self.setRpcData(result)
          self.setWarnings(
            result.skippedFeatureCount > 0
              ? [
                  {
                    message: `${result.skippedFeatureCount} of ${result.totalFeatureCount} features could not be mapped to the configured assemblies`,
                    effect:
                      'This usually means chromosome names in the file do not match the assembly. Check assembly aliases or that the correct assemblies are selected.',
                  },
                ]
              : [],
          )
        } catch (e) {
          if (isCurrent() && !isAbortException(e)) {
            self.setError(e)
          }
        }
      },
      { name: 'DotplotFetch', delay: RPC_DEBOUNCE_MS },
    ),
  )

  addDisposer(
    self,
    autorun(
      function dotplotGeometryRecompute() {
        const view = getContainingView(self) as DotplotViewModel
        const { rpcData, alpha, colorBy, minAlignmentLength } = self
        if (!rpcData) {
          return
        }
        const { drawCigar, hview, vview } = view
        // GPU precision anchor: the viewport-start cumBp per axis at build time.
        // Read offsetPx untracked so panning alone doesn't rebuild geometry
        // (pan is a uniform-only update on the GPU); a zoom changes bpPerPx,
        // which IS tracked, so the base is recaptured near the view on zoom.
        const { baseH, baseV } = untracked(() => ({
          baseH: hview.offsetPx * hview.bpPerPx,
          baseV: vview.offsetPx * vview.bpPerPx,
        }))
        self.setGeometry(
          buildLineSegments(
            rpcData,
            createDotplotColorFunction(coerceColorBy(colorBy), alpha, rpcData),
            drawCigar,
            minAlignmentLength,
            hview.bpPerPx,
            vview.bpPerPx,
            baseH,
            baseV,
          ),
        )
      },
      { name: 'DotplotGeometryRecompute' },
    ),
  )

  // One-shot at view load: compare the adapter's reported refNames per axis
  // against each assembly's full refNames to flag a reversed X/Y setup. Runs
  // off the per-render fetch path so it never re-fires (or misfires) on zoom.
  addDisposer(
    self,
    autorun(
      async function dotplotAssemblySwapCheck() {
        const view = getContainingView(self) as DotplotViewModel
        const [hAsm, vAsm] = view.assemblyNames
        if (!view.initialized) {
          return
        }
        const swapped = await detectDisplayAssembliesSwapped(self, hAsm, vAsm)
        if (isAlive(self)) {
          self.setAssembliesSwapped(swapped)
        }
      },
      { name: 'DotplotAssemblySwapCheck' },
    ),
  )

  addDisposer(self, () => {
    fetch.dispose()
  })
}
