import {
  getCanonicalRefNameFn,
  installAssemblySwapCheck,
  installComparativeFetchAutorun,
  renameDictLane,
} from '@jbrowse/synteny-core'
import { untracked } from 'mobx'

import { renameOffscreenMates } from '../LinearSyntenyRPC/collectOffscreenMates.ts'

import type { LinearSyntenyDisplayModel } from './model.ts'

const RPC_DEBOUNCE_MS = 500

// The fetch skeleton — token rotation, leading-edge debounce, loading/error
// flags, refName reconciliation and the latest-wins staleness discipline — is
// `installComparativeFetchAutorun` (shared with dotplot-view's fetch); only the
// synteny-specific gate, tracked deps, RPC args and result handling live here.
export function doAfterAttach(self: LinearSyntenyDisplayModel) {
  installComparativeFetchAutorun(self, {
    name: 'SyntenyFetch',
    delay: RPC_DEBOUNCE_MS,
    prepare: () => {
      // A synteny level draws between two adjacent genome views; this display
      // only depends on those two, not the whole stack. `fetchInert` is the
      // shared gate — the loading overlay and the SVG export read the same one,
      // so neither can wait on a fetch this decides not to run.
      const connected = self.fetchInert ? undefined : self.connectedViews
      if (connected) {
        const { v0, v1 } = connected
        // The only other tracked dep. `currentFetchKey` folds every input this
        // fetch depends on — both views' region sets, the snapped fetch window,
        // the log2 zoom bucket, the CIGAR draw options and the resolved
        // LOD tier — into one computed, so the autorun refires exactly when a
        // refetch is needed. Tracking the underlying observables individually
        // (as this once did) is strictly noisier: a setDisplayedRegions that
        // yields an identical region signature would refetch data that is still
        // valid. Same shape as dotplot's fetch.
        const fetchKey = self.currentFetchKey
        // Untracked: the values behind that key, and the raw geometry the
        // worker culls with. Reading them here rather than as deps keeps
        // offsetPx/width changes from refiring the fetch, while the worker
        // still sees the current axes.
        //
        // Query axis (v0) drives the scoped fetch, so it alone carries the cull
        // width; the target axis (v1) supplies its cumBp index + cull geometry,
        // and its own fetch window only when the view asked for the second
        // query (`targetFetchRegions` is [] otherwise).
        // eslint-disable-next-line no-restricted-syntax -- effect input: the worker consumes the geometry, fetchKey is the decision
        return untracked(() => {
          const { view } = self
          return {
            fetchKey,
            drawCIGAR: view.drawCIGAR,
            drawCIGARMatchesOnly: view.drawCIGARMatchesOnly,
            lodTier: self.lodTier,
            // Captured as strings HERE, not derived from `displayedRegions`
            // after the RPC: those are MST nodes and a fetch can outlive the
            // level it was started from, where reading one throws into an
            // unawaited promise. `assemblyNames` is the unique set of the
            // regions' own `assemblyName`s, so this is the same value read
            // while it is still safe to read.
            queryAssemblyName: v0.assemblyNames[0],
            targetAssemblyName: v1.assemblyNames[0],
            rawQuery: {
              bpPerPx: v0.bpPerPx,
              offsetPx: v0.offsetPx,
              displayedRegions: v0.displayedRegions,
              width: v0.width,
              fetchRegions: self.fetchRegions,
            },
            rawTarget: {
              bpPerPx: v1.bpPerPx,
              offsetPx: v1.offsetPx,
              displayedRegions: v1.displayedRegions,
              fetchRegions: self.targetFetchRegions,
            },
          }
        })
      }
      return undefined
    },
    run: async (
      {
        rawQuery,
        rawTarget,
        queryAssemblyName,
        targetAssemblyName,
        drawCIGAR,
        drawCIGARMatchesOnly,
        lodTier,
      },
      ctx,
    ) => {
      const { adapterConfig, rename, assemblyManager } = ctx
      // Both axes rename their displayed regions; each renames its fetch window
      // too, and the target's is empty unless the view asked for the second
      // query — in which case the worker needs it in the adapter's spelling for
      // exactly the reason the query axis does.
      const queryView = {
        ...rawQuery,
        displayedRegions: await rename(rawQuery.displayedRegions),
        fetchRegions: await rename(rawQuery.fetchRegions),
      }
      const targetView = {
        ...rawTarget,
        displayedRegions: await rename(rawTarget.displayedRegions),
        fetchRegions: rawTarget.fetchRegions.length
          ? await rename(rawTarget.fetchRegions)
          : undefined,
      }
      const result = await ctx.callRpc('SyntenyGetFeaturesAndPositions', {
        adapterConfig,
        queryView,
        targetView,
        drawCIGAR,
        drawCIGARMatchesOnly,
        lodMode: lodTier,
      })

      // AND BACK AGAIN, which the inbound rename above does not do for us. A
      // synteny feature names a contig on the OTHER axis — that is what a
      // synteny feature IS — so the answer is about a region nobody requested
      // and arrives in the file's spelling, while every main-thread reader
      // compares it against canonical view state. See
      // `agent-docs/reference/REFNAME_NAMESPACES.md`, and note the second
      // channel: `ResolvedSpan.refName` is renamed in `resolveMatchingSpan`,
      // and doing either alone is worse than doing neither.
      //
      // ONE RESOLVER PER AXIS, not one shared, so two contigs spelled alike on
      // the two assemblies cannot collide. Both assemblies are loaded by now —
      // `rename` above needed them — so neither await goes to the network.
      const [queryCanonical, targetCanonical] = await Promise.all([
        getCanonicalRefNameFn({
          assemblyManager,
          assemblyName: queryAssemblyName,
        }),
        getCanonicalRefNameFn({
          assemblyManager,
          assemblyName: targetAssemblyName,
        }),
      ])
      const query = renameDictLane({
        dict: result.refNameDict,
        ids: result.refNameIds,
        canonical: queryCanonical,
      })
      const target = renameDictLane({
        dict: result.mateRefNameDict,
        ids: result.mateRefNameIds,
        canonical: targetCanonical,
      })
      // A THIRD LANE, same class, different namespace: `mateAssemblyNameDict`
      // holds the adapter's `assemblyNames[]` verbatim, which is config text,
      // and `pickFollowFeature` / `followWindowMapping` / `centerOnFeature`
      // compare it against a view's `assemblyNames[0]`, which is canonical
      // because it comes off the assembly's own regions. A track declaring its
      // SECOND assembly by an alias is offered on the level anyway —
      // `syntenyTrackRows` resolves it through `canonicalAssemblyNames` — so the
      // ribbons draw, the id lookup misses, `mateAssemblyId` is -1, and the
      // filter drops every candidate rather than skipping. The follow then
      // reports the whole window unaligned.
      //
      // Only the MATE lane. `assemblyNameDict` goes back OUT — `feat.assemblyName`
      // is the `regions[]` assembly of `SyntenyResolveMatchingRegion`, which the
      // adapter matches against its own `assemblyNames[]` — so canonicalizing it
      // would break the lookup that currently works.
      const mateAssembly = renameDictLane({
        dict: result.mateAssemblyNameDict,
        ids: result.mateAssemblyNameIds,
        canonical: name =>
          assemblyManager.getCanonicalAssemblyName(name) ?? name,
      })
      return {
        ...result,
        refNameDict: query.dict,
        refNameIds: query.ids,
        mateRefNameDict: target.dict,
        mateRefNameIds: target.ids,
        mateAssemblyNameDict: mateAssembly.dict,
        mateAssemblyNameIds: mateAssembly.ids,
        // THE MATE LANES OF THE OTHER TWO DICTIONARIES, and they take OPPOSITE
        // resolvers: an off-screen mate names a contig on the far side of the
        // band from the axis its mark is placed on, so the query-axis strip's
        // names belong to the target assembly and the target-axis strip's to
        // the query one. Sharing one resolver reads as working on any pair
        // whose two assemblies spell a contig alike, which is most of them.
        offscreenMates: renameOffscreenMates(
          result.offscreenMates,
          targetCanonical,
        ),
        targetOffscreenMates: renameOffscreenMates(
          result.targetOffscreenMates,
          queryCanonical,
        ),
      }
    },
    commit: ({ instanceData, ...featureData }, { fetchKey }) => {
      // Before the data lands, because the accumulated domain has to outlive
      // this payload: `attributeRanges` reports the span of the SLICE this
      // window fetched, and the ramp an `attribute:<column>` mode paints would
      // otherwise re-scale on every pan that rolls the window over.
      self.view.observeAttributeRanges(featureData.attributeRanges)
      self.setRpcData(featureData, instanceData, fetchKey)
    },
  })

  // Compare the adapter's reported refNames per row against each assembly's
  // full refNames to flag a reversed row order. The top row of this level is
  // the one the adapter's names are checked against, so the pair goes in row
  // order.
  installAssemblySwapCheck(self, {
    name: 'SyntenyAssemblySwapCheck',
    axisAssemblies: () => {
      const { view, level } = self
      return view.initialized && level + 1 < view.views.length
        ? [
            view.views[level]!.assemblyNames[0],
            view.views[level + 1]!.assemblyNames[0],
          ]
        : undefined
    },
  })
}
