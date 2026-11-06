import { observer } from 'mobx-react'

import FeatureDetails from './FeatureDetails.tsx'
import FeatureDetailsFrame from './FeatureDetailsFrame.tsx'
import ParentFeatureLine from './ParentFeatureLine.tsx'
import {
  jexlFilterDisplay,
  rawValueFilterActions,
} from './jexlFilterActions.ts'

import type { BaseFeatureWidgetModel } from '../stateModelFactory.ts'
import type { Descriptors } from '../types.tsx'

const BaseFeatureDetail = observer(function BaseFeatureDetail({
  model,
}: {
  model: BaseFeatureWidgetModel
}) {
  const { featureData, unformattedFeatureData, parentFeature } = model
  // annotated to shed the MST node brand types.frozen() carries on the instance
  const descriptions: Descriptors | undefined = model.descriptions
  // a track's filter tests its top-level features, so a panel opened on a
  // transcript inside a gene offers none
  const display = parentFeature ? undefined : jexlFilterDisplay(model.track)
  return (
    <FeatureDetailsFrame model={model}>
      {featureData ? (
        <>
          {parentFeature ? (
            <ParentFeatureLine parentFeature={parentFeature} />
          ) : null}
          <FeatureDetails
            model={model}
            feature={featureData}
            unformatted={unformattedFeatureData}
            descriptions={descriptions}
            fieldActions={
              display && unformattedFeatureData
                ? rawValueFilterActions(display, unformattedFeatureData)
                : undefined
            }
          />
        </>
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
export { default as FeatureWash } from './FeatureWash.tsx'
export { FeatureTrackContext, featureKey, useFeatureKey } from './featureKey.ts'
export {
  filterByValueItems,
  jexlFilterDisplay,
  rawValueFilterActions,
} from './jexlFilterActions.ts'
