import type { RenderLDDataArgs } from '../RenderLDDataRPC/RenderLDData.ts'
import type { LDDataResult } from '../RenderLDDataRPC/types.ts'
import type { Region } from '@jbrowse/core/util'
import type { GlobalFetchPhases } from '@jbrowse/display-kit/installGlobalFetchAutorun'
import type { RegionHost } from '@jbrowse/display-kit/regionHost'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

// `IStateTreeNode`, never `IAnyStateTreeNode` — the latter resolves to `any` and
// silently turns off checking for every member below. See the note on
// `FetchSelf` in canvas's fetchMultiRowFeatures.ts.
export interface LDFetchSelf extends IStateTreeNode {
  showLDTriangle: boolean
  host: RegionHost
  adapterConfig: Record<string, unknown>
  // Derived from the RPC's own arg type rather than restated, so a field added
  // to the payload cannot arrive here under a different name.
  rpcProps(): Omit<
    RenderLDDataArgs,
    'adapterConfig' | 'regions' | 'originBp' | 'byteLimit'
  >
  // `RegionTooLargeMixin`'s: the budget the worker enforces, and the same one
  // the banner compares against
  resolvedByteLimit(): number | undefined
  setRpcData(data: LDDataResult): void
}

interface LDFetchArgs {
  regions: Region[]
  originBp: number
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
 * on demand passes them to `runGlobalFetch`. The shared gates — minimized,
 * data-current, the byte measurement the result carries, the signature stamp at
 * commit — live
 * in `runGlobalFetch` (and the region-too-large skip one level up in the
 * skeleton), so what is left here is LD's own: the triangle toggle, the block
 * set, the axis origin, and the budget the worker measures against.
 */
export function ldFetchPhases(
  self: LDFetchSelf,
): GlobalFetchPhases<LDFetchArgs, LDDataResult> {
  return {
    prepare: () => {
      const regions = self.host.dynamicBlocks.contentBlocks
      return !self.showLDTriangle || !regions.length
        ? undefined
        : {
            regions: [...regions],
            originBp: axisOriginBp(regions[0]!, self.host.displayedRegions),
          }
    },
    run: ({ regions, originBp }, ctx) =>
      ctx.callRpc('RenderLDData', {
        adapterConfig: self.adapterConfig,
        regions,
        originBp,
        byteLimit: self.resolvedByteLimit(),
        ...self.rpcProps(),
      }),
    commit: result => {
      self.setRpcData(result)
    },
  }
}
