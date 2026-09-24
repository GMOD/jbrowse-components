import { observer } from 'mobx-react'

import FeatureDetails from './FeatureDetails.tsx'
import FeatureDetailsFrame from './FeatureDetailsFrame.tsx'
import ParentFeatureLine from './ParentFeatureLine.tsx'

import type { Descriptors } from '../types.tsx'
import type { BaseInputProps } from './types.ts'

const BaseFeatureDetail = observer(function BaseFeatureDetail({
  model,
}: BaseInputProps) {
  const { featureData, unformattedFeatureData, parentFeature } = model
  // annotated to shed the MST node brand types.frozen() carries on the instance
  const descriptions: Descriptors | undefined = model.descriptions
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
export { filterByValueItems, jexlFilterDisplay } from './jexlFilterActions.ts'
