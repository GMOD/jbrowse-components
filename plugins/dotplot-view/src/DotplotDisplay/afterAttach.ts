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
import { dotplotFetchKey } from './fetchKey.ts'

import type { Dotplot1DViewModel } from '../DotplotView/1dview.ts'
import type { DotplotViewModel } from '../DotplotView/model.ts'
import type { DotplotDisplayModel } from './stateModelFactory.tsx'
import type { Region } from '@jbrowse/core/util'
import type { BpIndexViewSnap } from '@jbrowse/synteny-core'

const RPC_DEBOUNCE_MS = 1000

function makeViewSnap(view: Dotplot1DViewModel): BpIndexViewSnap {
  return {
    bpPerPx: view.bpPerPx,
    displayedRegions: view.displayedRegions,
  }
}

// True when any refName a skipped feature named is absent from that axis's
// assembly ENTIRELY — the only case the "could not be mapped" warning is about.
// A name that IS in the assembly but not currently displayed means the axis was
// restricted on purpose, not misconfigured. The skipped names arrive in the
// adapter's namespace (the worker only ever sees renamed regions), so the
// assembly's own regions are put through the same rename before comparing —
// otherwise every aliased name would read as unknown and the warning would fire
// on exactly the configs that alias correctly.
async function hasUnknownRefNames({
  assemblyManager,
  rename,
  axes,
}: {
  assemblyManager: ReturnType<typeof getSession>['assemblyManager']
  rename: (regions: Region[]) => Promise<Region[]>
  axes: { assemblyName?: string; skipped: string[] }[]
}) {
  for (const { assemblyName, skipped } of axes) {
    if (skipped.length) {
      const regions = assemblyName
        ? assemblyManager.get(assemblyName)?.regions
        : undefined
      // no assembly to check against => can't clear the names, so treat them as
      // unknown and keep the old (louder) behavior
      if (!regions) {
        return true
      }
      const known = new Set((await rename(regions)).map(r => r.refName))
      if (skipped.some(n => !known.has(n))) {
        return true
      }
    }
  }
  return false
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
        // Snapshot the fetch-input signature now, from the exact inputs this
        // fetch uses, so the resulting rpcData is tagged with what it was
        // fetched for even if the view changes again mid-RPC.
        const fetchKey = dotplotFetchKey(lodMode, hViewSnap, vViewSnap)

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
          self.setRpcData(result, fetchKey)
          // Skipped features are only worth warning about when the refName is
          // genuinely absent from the assembly. An axis restricted to a subset
          // of its assembly (per-axis `displayedRegionNames` — e.g. one
          // haplotype of a haplotype-resolved assembly) skips every alignment
          // to the regions it isn't showing, which is exactly what was asked
          // for; warning there fires on every such plot and tells the user to
          // go fix a name mismatch that doesn't exist. Resolving the names
          // needs the assemblyManager, so it happens here rather than in the
          // worker — and only when something was skipped, so the extra rename
          // stays off the normal fetch path.
          const mismatched =
            result.skippedFeatureCount > 0 &&
            (await hasUnknownRefNames({
              assemblyManager,
              rename,
              axes: [
                {
                  assemblyName: hViewSnap.displayedRegions[0]?.assemblyName,
                  skipped: result.skippedHRefNames,
                },
                {
                  assemblyName: vViewSnap.displayedRegions[0]?.assemblyName,
                  skipped: result.skippedVRefNames,
                },
              ],
            }))
          self.setWarnings(
            mismatched
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
        // getContainingView reads the parent atom (a tracked MST observable);
        // removeView detaches self and fires that atom, re-running this autorun
        // before its disposer teardown. Bail while dead so getContainingView
        // doesn't dereference a node no longer in the tree.
        if (!isAlive(self)) {
          return
        }
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
        if (!isAlive(self)) {
          return
        }
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
