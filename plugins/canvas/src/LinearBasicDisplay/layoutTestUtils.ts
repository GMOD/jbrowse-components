import { createContentHeightProbe } from './layout.ts'

import type { LayoutInputs, LayoutRegionData } from './layoutInputs.ts'

// A test oracle through the same `packPreparedRef`, so a test asserts the
// committed height without a second implementation to disagree with.
export function packedContentHeight(
  rpcDataMap: ReadonlyMap<number, LayoutRegionData>,
  inputs: LayoutInputs,
) {
  return createContentHeightProbe(
    rpcDataMap,
    inputs,
  )(inputs.labelRoomFactor ?? 1)
}
