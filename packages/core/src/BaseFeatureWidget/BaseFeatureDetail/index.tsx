import { observer } from 'mobx-react'

import FeatureDetails from './FeatureDetails.tsx'
import { isEmpty } from './util.ts'
import { ErrorMessage } from '../../ui/index.ts'
import { replaceUndefinedWithNull } from '../util.tsx'

import type { BaseInputProps } from './types.ts'

const BaseFeatureDetail = observer(function BaseFeatureDetail({
  model,
}: BaseInputProps) {
  const { error, descriptions, featureData } = model

  if (error) {
    return <ErrorMessage error={error} />
  } else if (!featureData) {
    return null
  } else {
    // replacing undefined with null helps with allowing fields to be hidden,
    // setting null is not allowed by jexl so we set it to undefined to hide.
    // see config guide. this replacement happens both here and when
    // snapshotting the featureData
    const featureData2 = replaceUndefinedWithNull(featureData)
    return isEmpty(featureData2) ? null : (
      <FeatureDetails
        model={model}
        feature={featureData2}
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
