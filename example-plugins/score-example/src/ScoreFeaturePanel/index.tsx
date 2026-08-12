// #exampleFile shared | adds a panel to the feature details widget
import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { addFeaturePanel } from '@jbrowse/core/ui'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { FeaturePanelProps } from '@jbrowse/core/PluginManager'

// The display draws a box whose height is the feature's score; this says what
// that number actually is when you click the box. A panel renders its own card
// chrome, so it starts at BaseCard rather than assuming a wrapper.
// #region panel
function ScoreFeaturePanel({ feature }: FeaturePanelProps) {
  return (
    <BaseCard title="Score">
      <div>{String(feature.score)}</div>
    </BaseCard>
  )
}
// #endregion

// #region register
export default function ScoreFeaturePanelF(pluginManager: PluginManager) {
  addFeaturePanel(pluginManager, {
    select: {
      // the track type this plugin's display attaches to
      trackType: 'FeatureTrack',
      // `where` reaches what the declarative fields cannot: the feature itself,
      // and how deep in the subfeature tree this card is. depth 0 is the
      // feature that was clicked — without it the panel repeats on every
      // subfeature card. The score check keeps it off features that have none,
      // since one FeatureTrack's features may carry a score and another's may
      // not.
      where: ({ feature, depth }) => depth === 0 && feature.score !== undefined,
    },
    panel: ScoreFeaturePanel,
  })
}
// #endregion
