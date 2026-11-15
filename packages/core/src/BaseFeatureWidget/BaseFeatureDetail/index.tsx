import { observer } from 'mobx-react'

import FeatureDetailsFrame from './FeatureDetailsFrame.tsx'
import FeatureDetailsPanel from './FeatureDetailsPanel.tsx'

import type { BaseFeatureWidgetModel } from '../stateModelFactory.ts'
import type { Descriptors } from '../types.tsx'

const BaseFeatureDetail = observer(function BaseFeatureDetail({
  model,
}: {
  model: BaseFeatureWidgetModel
}) {
  const { featureData, unformattedFeatureData } = model
  // annotated to shed the MST node brand types.frozen() carries on the instance
  const descriptions: Descriptors | undefined = model.descriptions
  return (
    <FeatureDetailsFrame model={model}>
      {featureData && unformattedFeatureData ? (
        <FeatureDetailsPanel
          model={model}
          feature={featureData}
          unformatted={unformattedFeatureData}
          descriptions={descriptions}
        />
      ) : null}
    </FeatureDetailsFrame>
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
