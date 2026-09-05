import { createContentHeightProbe } from './layout.ts'

import type { LayoutInputs, LayoutRegionData } from './layoutInputs.ts'

// One-shot height for fully-formed inputs — `createContentHeightProbe` for a
// single factor. Same pack, so the same guarantee.
//
// The test oracle, not a production path: the fit solve holds one probe across
// its ~9 candidate factors and nothing else asks for a single height. Its value
// is exactly that it goes through the same `packPreparedRef`, so a test can
// assert the committed layout's height without a second implementation to
// disagree with.
export function packedContentHeight(
  rpcDataMap: ReadonlyMap<number, LayoutRegionData>,
  inputs: LayoutInputs,
) {
  return createContentHeightProbe(
    rpcDataMap,
    inputs,
  )(inputs.labelRoomFactor ?? 1)
}
