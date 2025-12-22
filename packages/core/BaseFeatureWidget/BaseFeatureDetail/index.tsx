import { observer } from 'mobx-react'

import FeatureDetails from './FeatureDetails'
import { isEmpty } from './util'
import { ErrorMessage } from '../../ui'
import { replaceUndefinedWithNull } from '../util'

import type { BaseInputProps } from './types'

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

export { default as BaseCard } from './BaseCard'
export { default as BaseAttributes } from './BaseAttributes'
export { default as BaseCoreDetails } from './BaseCoreDetails'
export { default as FeatureDetails } from './FeatureDetails'
