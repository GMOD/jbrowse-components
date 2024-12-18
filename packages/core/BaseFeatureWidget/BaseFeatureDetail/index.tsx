import { observer } from 'mobx-react'

// utils
import { isEmpty } from './util'
import Attributes from './Attributes'
import BaseCard from './BaseCard'
import CoreDetails from './CoreDetails'
import FeatureDetails from './FeatureDetails'
import { ErrorMessage } from '../../ui'

import type { BaseCardProps, BaseProps } from '../types'

export const BaseCoreDetails = (props: BaseProps) => {
  const { title = 'Primary data' } = props
  return (
    <BaseCard {...props} title={title}>
      <CoreDetails {...props} />
    </BaseCard>
  )
}

export const BaseAttributes = (props: BaseProps) => {
  const { feature } = props
  return (
    <BaseCard {...props} title="Attributes">
      <Attributes {...props} attributes={feature} />
    </BaseCard>
  )
}

export interface BaseInputProps extends BaseCardProps {
  omit?: string[]
  model: any
  descriptions?: Record<string, React.ReactNode>
  formatter?: (val: unknown, key: string) => React.ReactNode
}

const BaseFeatureDetail = observer(function ({ model }: BaseInputProps) {
  const { error, featureData } = model

  if (error) {
    return <ErrorMessage error={error} />
  } else if (!featureData || isEmpty(featureData)) {
    return null
  } else {
    return <FeatureDetails model={model} feature={featureData} />
  }
})

export default BaseFeatureDetail

export { default as BaseCard } from './BaseCard'
export { default as FeatureDetails } from './FeatureDetails'
