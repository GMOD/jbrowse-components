import { getRpcSessionId, getSession } from '@jbrowse/core/util'

import type { RenderLDDataArgs } from '../RenderLDDataRPC/RenderLDData.ts'
import type { LDDataResult } from '../RenderLDDataRPC/types.ts'
import type { Region } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type {
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
  ldFetchSignature: string | undefined
  // Derived from the RPC's own arg type rather than restated, so a field added
  // to the payload cannot arrive here under a different name.
  rpcProps(): Omit<RenderLDDataArgs, 'adapterConfig' | 'regions' | 'originBp'>
  byteGateBlocksFetch(regions: Region[], ctx: FetchContext): Promise<boolean>
  setRpcData(data: LDDataResult | null, signature?: string): void
}

interface LDFetchArgs {
  regions: Region[]
  originBp: number
  signature: string
}

/**
 * Axis-bp position of a block's leading (leftmost-on-screen) edge: the
 * cumulative span of every displayed region before it — elided ones included,
 * since the ruler still gives them their width — plus its lead within its own
 * region, which for a reversed region is measured from the region's right end.
 * The payload's pre-rotation coordinates are relative to the first fetched
 * block's value of this; the model folds it back in per frame
 * (`viewTransform`).
 */
function axisOriginBp(
  block: { start: number; end: number; displayedRegionIndex?: number },
  displayedRegions: { start: number; end: number; reversed?: boolean }[],
) {
  const idx = block.displayedRegionIndex!
  let acc = 0
  for (let i = 0; i < idx; i++) {
    const r = displayedRegions[i]!
    acc += r.end - r.start
  }
  const d = displayedRegions[idx]!
  return acc + (d.reversed ? d.end - block.end : block.start - d.start)
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
      const signature = self.ldFetchSignature
      return self.isMinimized ||
        !self.showLDTriangle ||
        !regions.length ||
        signature === undefined
        ? undefined
        : {
            regions: [...regions],
            signature,
            originBp: axisOriginBp(regions[0]!, self.lgv.displayedRegions),
          }
    },
    run: async ({ regions, originBp }, ctx) =>
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
              originBp,
              ...self.rpcProps(),
              stopToken: ctx.stopToken,
              statusCallback: ctx.statusCallback,
            },
          ),
    commit: (result, { signature }) => {
      self.setRpcData(result, signature)
    },
  }
}
