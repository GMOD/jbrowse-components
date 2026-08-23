import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import {
  installAssemblySwapCheck,
  installComparativeFetchAutorun,
} from '@jbrowse/synteny-core'
import { autorun, untracked } from 'mobx'

import { buildLineSegments } from './dotplotGeometry.ts'

import type { Dotplot1DViewModel } from '../DotplotView/1dview.ts'
import type { DotplotDisplayModel } from './stateModelFactory.tsx'
import type { AssemblyManager, Region } from '@jbrowse/core/util'
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
  assemblyManager: AssemblyManager
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

// The fetch skeleton — token rotation, leading-edge debounce, loading/error
// flags, refName reconciliation and the latest-wins staleness discipline — is
// `installComparativeFetchAutorun` (shared with linear-comparative-view's
// synteny fetch); only the dotplot-specific gate, RPC args and result handling
// live here.
export function doAfterAttach(
  self: Omit<DotplotDisplayModel, 'afterAttach' | 'beforeDestroy'>,
) {
  installComparativeFetchAutorun(self, {
    name: 'DotplotFetch',
    delay: RPC_DEBOUNCE_MS,
    prepare: () => {
      const { view } = self
      if (view.initialized) {
        // The only tracked view dep. `currentFetchKey` folds every input this
        // fetch depends on — LOD tier, both axes' zoom and displayed-region
        // order, and the snapped h-axis fetch window — into one computed, so
        // the autorun refires exactly when a refetch is actually needed.
        // #region untracked
        const fetchKey = self.currentFetchKey
        // Untracked: the values behind that key. Reading them here rather than
        // as deps keeps raw offsetPx/width changes from refiring the fetch,
        // while the worker still sees the current axes.
        // eslint-disable-next-line no-restricted-syntax -- effect input: the worker consumes the axes, fetchKey is the decision
        return untracked(() => ({
          fetchKey,
          // the resolved tier, which is what `currentFetchKey` above carries —
          // `view.lodMode` stays 'auto' while the tier flips under it
          lodTier: self.lodTier,
          hViewSnap: makeViewSnap(view.hview),
          vViewSnap: makeViewSnap(view.vview),
          regions: self.fetchRegions,
        }))
        // #endregion
      }
      return undefined
    },
    run: async ({ lodTier, hViewSnap, vViewSnap, regions }, ctx) => {
      const { adapterConfig, rename, assemblyManager } = ctx
      const result = await ctx.callRpc('DotplotGetFeaturesAndPositions', {
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
        lodMode: lodTier,
      })
      // Skipped features are only worth warning about when the refName is
      // genuinely absent from the assembly. An axis restricted to a subset of
      // its assembly (per-axis `displayedRegionNames` — e.g. one haplotype of a
      // haplotype-resolved assembly) skips every alignment to the regions it
      // isn't showing, which is exactly what was asked for; warning there fires
      // on every such plot and tells the user to go fix a name mismatch that
      // doesn't exist. Resolving the names needs the assemblyManager, so it
      // happens here rather than in the worker — and only when something was
      // skipped, so the extra rename stays off the normal fetch path.
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
      return { result, mismatched }
    },
    commit: ({ result, mismatched }, { fetchKey }) => {
      // Before the data lands — see the synteny twin: the accumulated ramp
      // domain has to outlive the payload whose span it was widened by.
      self.view.observeAttributeRanges(result.attributeRanges)
      self.setRpcData(
        result,
        fetchKey,
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
    },
  })

  addDisposer(
    self,
    autorun(
      function dotplotGeometryRecompute() {
        // `self.view` resolves through getContainingView, which reads the
        // parent atom (a tracked MST observable); removeView detaches self and
        // fires that atom, re-running this autorun before its disposer
        // teardown. Bail while dead so it doesn't dereference a node no longer
        // in the tree.
        if (!isAlive(self)) {
          return
        }
        const { view } = self
        // colorBy/alpha are deliberately absent: colors are a separate
        // main-thread pass over instanceFeatureIdx (the `computedColors`
        // getter), so a palette change never re-walks the CIGARs here.
        const { rpcData } = self
        if (!rpcData) {
          return
        }
        const { drawCigar, hview, vview, minAlignmentLength, minIdentity } =
          view
        // GPU precision anchor: the viewport-start cumBp per axis at build time.
        // Read offsetPx untracked so panning alone doesn't rebuild geometry
        // (pan is a uniform-only update on the GPU); a zoom changes bpPerPx,
        // which IS tracked, so the base is recaptured near the view on zoom.
        // eslint-disable-next-line no-restricted-syntax -- effect input: the geometry build consumes the pan offset, zoom is the decision
        const { baseH, baseV } = untracked(() => ({
          baseH: hview.offsetPx * hview.bpPerPx,
          baseV: vview.offsetPx * vview.bpPerPx,
        }))
        self.setInstanceData(
          buildLineSegments(
            rpcData,
            drawCigar,
            minAlignmentLength,
            minIdentity,
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

  // Compare the adapter's reported refNames per axis against each assembly's
  // full refNames to flag a reversed X/Y setup. The h axis is the one the
  // adapter's names are checked against, so the pair goes in axis order.
  installAssemblySwapCheck(self, {
    name: 'DotplotAssemblySwapCheck',
    axisAssemblies: () => {
      const { assemblyNames, initialized } = self.view
      return initialized ? [assemblyNames[0], assemblyNames[1]] : undefined
    },
  })
}
