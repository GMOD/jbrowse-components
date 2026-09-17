import { copyText } from '@jbrowse/core/util/copyText'

import type { Feature } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

// Just enough to resolve the read the menu was opened over — what
// `withContextMenuFeature` and `copyFeatureInfo` take, so an extension point
// that only wants those two doesn't declare a hit-test surface it never reads.
export interface FeatureLookupModel extends IStateTreeNode {
  withFeatureById: (
    featureId: string,
    onFeat: (feat: Feature) => void,
  ) => Promise<void>
}

// Act on the read the menu was opened over. `feat` is the fetched feature as
// captured when this menu was built: the fetch landing re-runs the menu builder,
// so by the time anything is clicked it is normally in hand and this is
// synchronous. The id path covers the narrow case of a click that beats the RPC.
// Neither can be read live inside the onClick — closeContextMenu clears both
// before the callback fires.
export function withContextMenuFeature(
  self: FeatureLookupModel,
  featureId: string,
  feat: Feature | undefined,
  onFeat: (feat: Feature) => void,
) {
  if (feat) {
    onFeat(feat)
  } else {
    void self.withFeatureById(featureId, onFeat)
  }
}

// The whole feature as JSON, minus the synthetic uniqueId — the "all fields"
// copy, shared with the displays that offer it as a top-level item rather than
// inside a Copy submenu (LGVSyntenyDisplay, whose PAF block has no read name or
// sequence to copy beside it).
export function copyFeatureInfo(self: IStateTreeNode, feat: Feature) {
  const { uniqueId: _uniqueId, ...rest } = feat.toJSON()
  void copyText(self, JSON.stringify(rest, null, 4), 'feature info')
}
