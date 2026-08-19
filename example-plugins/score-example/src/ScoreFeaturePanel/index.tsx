// #exampleFile shared | adds a panel to the feature details widget
import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { ForTrack } from '@jbrowse/core/ui'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { FeaturePanelProps } from '@jbrowse/core/PluginManager'

// The display draws a box whose height is the feature's score; this says what
// that number actually is when you click the box. A panel renders its own card
// chrome, so it starts at BaseCard rather than assuming a wrapper, and it says
// which tracks it belongs on itself: the point fires for every feature details
// widget there is.
//
// `depth` is 0 on the feature the user clicked, so without it the panel repeats
// on every subfeature card. The score check keeps it off features that have
// none, since one FeatureTrack's features may carry a score and another's may
// not.
// #region panel
function ScoreFeaturePanel(props: FeaturePanelProps) {
  const { feature, depth } = props
  return depth === 0 && feature.score !== undefined ? (
    <ForTrack {...props} select={{ trackType: 'FeatureTrack' }}>
      <BaseCard title="Score">
        <div>{String(feature.score)}</div>
      </BaseCard>
    </ForTrack>
  ) : null
}
// #endregion

// #region register
export default function ScoreFeaturePanelF(pluginManager: PluginManager) {
  pluginManager.contributeToExtensionPoint(
    'Core-extraFeaturePanel',
    () => ScoreFeaturePanel,
  )
}
// #endregion
