import { observer } from 'mobx-react'

import { ErrorBanner } from '../../ui/index.ts'
import FeatureDetails from './FeatureDetails.tsx'
import FeatureWash from './FeatureWash.tsx'
import ParentFeatureLine from './ParentFeatureLine.tsx'
import { isEmpty } from './util.ts'

import type { Descriptors } from '../types.tsx'
import type { BaseInputProps } from './types.ts'

const BaseFeatureDetail = observer(function BaseFeatureDetail({
  model,
}: BaseInputProps) {
  const { error, featureData, unformattedFeatureData, parentFeature } = model
  // annotated to shed the MST node brand types.frozen() carries on the instance
  const descriptions: Descriptors | undefined = model.descriptions

  if (error) {
    return <ErrorBanner error={error} />
  } else if (!featureData || isEmpty(featureData)) {
    return null
  } else {
    return (
      <FeatureWash uniqueId={featureData.uniqueId}>
        {parentFeature ? (
          <ParentFeatureLine parentFeature={parentFeature} />
        ) : null}
        <FeatureDetails
          model={model}
          feature={featureData}
          unformatted={unformattedFeatureData}
          descriptions={descriptions}
        />
      </FeatureWash>
    )
  }
})

export default BaseFeatureDetail

export { default as BaseCard } from './BaseCard.tsx'
export { default as BaseAttributes } from './BaseAttributes.tsx'
export { default as BaseCoreDetails } from './BaseCoreDetails.tsx'
export { default as FeatureDetails } from './FeatureDetails.tsx'
export { default as FeatureWash } from './FeatureWash.tsx'
export { filterByValueItems, jexlFilterDisplay } from './jexlFilterActions.ts'
