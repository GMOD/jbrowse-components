import { observer } from 'mobx-react'

import FeatureDetails from './FeatureDetails.tsx'
import { isEmpty } from './util.ts'
import { ErrorBanner } from '../../ui/index.ts'

import type { BaseInputProps } from './types.ts'

const BaseFeatureDetail = observer(function BaseFeatureDetail({
  model,
}: BaseInputProps) {
  const { error, descriptions, featureData } = model

  // A field is hidden by a formatDetails callback returning undefined (jexl
  // can't produce null); every detail component filters with `!= null`, so a
  // field set to undefined (live) or null (round-tripped through a snapshot) is
  // dropped identically.
  if (error) {
    return <ErrorBanner error={error} />
  } else if (!featureData || isEmpty(featureData)) {
    return null
  } else {
    return (
      <FeatureDetails
        model={model}
        feature={featureData}
        descriptions={descriptions}
      />
    )
  }
})

export default BaseFeatureDetail

export { default as BaseCard } from './BaseCard.tsx'
export { default as BaseAttributes } from './BaseAttributes.tsx'
export { default as BaseCoreDetails } from './BaseCoreDetails.tsx'
export { default as FeatureDetails } from './FeatureDetails.tsx'
