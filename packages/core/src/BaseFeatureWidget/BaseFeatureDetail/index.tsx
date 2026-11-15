import { observer } from 'mobx-react'

import FeatureDetailsFrame from './FeatureDetailsFrame.tsx'
import FeatureDetailsPanel from './FeatureDetailsPanel.tsx'

import type { BaseFeatureWidgetModel } from '../stateModelFactory.ts'

const BaseFeatureDetail = observer(function BaseFeatureDetail({
  model,
}: {
  model: BaseFeatureWidgetModel
}) {
  return (
    <FeatureDetailsFrame
      model={model}
      renderBody={(feature, unformatted) => (
        <FeatureDetailsPanel
          model={model}
          feature={feature}
          unformatted={unformatted}
        />
      )}
    />
  )
})

export default BaseFeatureDetail

export { default as BaseCard } from './BaseCard.tsx'
export { default as BaseAttributes } from './BaseAttributes.tsx'
export { default as BaseCoreDetails } from './BaseCoreDetails.tsx'
export { default as FeatureDetails } from './FeatureDetails.tsx'
export { default as FeatureDetailsFrame } from './FeatureDetailsFrame.tsx'
export { default as FeatureDetailsPanel } from './FeatureDetailsPanel.tsx'
export { default as FeatureWash } from './FeatureWash.tsx'
export { FeatureTrackContext, featureKey, useFeatureKey } from './featureKey.ts'
export {
  filterByValueItems,
  jexlFilterDisplay,
  rawValueFilterActions,
} from './jexlFilterActions.ts'
