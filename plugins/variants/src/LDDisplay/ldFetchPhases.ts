import { getRpcSessionId, getSession } from '@jbrowse/core/util'

import type { RenderLDDataArgs } from '../RenderLDDataRPC/RenderLDData.ts'
import type { LDDataResult } from '../RenderLDDataRPC/types.ts'
import type { Region } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type {
  DrawnViewport,
  FetchContext,
  GlobalFetchPhases,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

// `IStateTreeNode`, never `IAnyStateTreeNode` — the latter resolves to `any` and
// silently turns off checking for every member below. See the note on
// `FetchSelf` in canvas's fetchMultiRowFeatures.ts.
export interface LDFetchSelf extends IStateTreeNode {
  isMinimized: boolean
  showLDTriangle: boolean
  lgv: LinearGenomeViewModel
  adapterConfig: Record<string, unknown>
  // Derived from the RPC's own arg type rather than restated, so a field added
  // to the payload cannot arrive here under a different name.
  rpcProps(): Omit<RenderLDDataArgs, 'adapterConfig' | 'regions' | 'bpPerPx'>
  captureViewport(): DrawnViewport
  commitDrawnViewport(viewport: DrawnViewport): void
  byteGateBlocksFetch(regions: Region[], ctx: FetchContext): Promise<boolean>
  setRpcData(data: LDDataResult | null): void
}

interface LDFetchArgs {
  regions: Region[]
  drawn: DrawnViewport
}

/**
 * The LD matrix fetch, as the three phases `installGlobalFetchAutorun` runs it
 * in. `afterAttach` hands these to the skeleton; a caller wanting one round trip
 * on demand passes them to `runGlobalFetch`.
 *
 * `regionTooLarge` is deliberately not a term in `prepare` — the skeleton owns
 * that skip, which lets a blocked display run this once per settled viewport so
 * the pre-flight below can re-measure and release the banner. Restating it here
 * returned before the gate, so the estimate froze at the viewport it was
 * captured over and zooming in could never clear the banner.
 */
export function ldFetchPhases(
  self: LDFetchSelf,
): GlobalFetchPhases<LDFetchArgs, LDDataResult> {
  return {
    prepare: () => {
      const regions = self.lgv.dynamicBlocks.contentBlocks
      return self.isMinimized || !self.showLDTriangle || !regions.length
        ? undefined
        : { regions: [...regions], drawn: self.captureViewport() }
    },
    run: async ({ regions, drawn }, ctx) =>
      // RegionTooLargeMixin's shared pre-flight gate (a no-op when
      // `measuresBytesPreFlight` is off), called directly because LD fetches
      // through GlobalFetchMixin rather than MultiRegionDisplayMixin's
      // fetchRegions. Blocking it means there is nothing to commit.
      (await self.byteGateBlocksFetch(regions, ctx))
        ? undefined
        : await getSession(self).rpcManager.call(
            getRpcSessionId(self),
            'RenderLDData',
            {
              adapterConfig: self.adapterConfig,
              regions,
              bpPerPx: drawn.bpPerPx,
              ...self.rpcProps(),
              stopToken: ctx.stopToken,
              statusCallback: ctx.statusCallback,
            },
          ),
    commit: (result, { drawn }) => {
      self.setRpcData(result)
      self.commitDrawnViewport(drawn)
    },
  }
}
