import BaseCard from './BaseCard'
import CoreDetails from './CoreDetails'

import type { BaseProps } from '../types'

export default function BaseCoreDetails(props: BaseProps) {
  const { title = 'Primary data' } = props
  return (
    <BaseCard {...props} title={title}>
      <CoreDetails {...props} />
    </BaseCard>
  )
}
