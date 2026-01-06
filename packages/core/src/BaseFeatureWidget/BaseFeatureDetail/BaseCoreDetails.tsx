import BaseCard from './BaseCard.tsx'
import CoreDetails from './CoreDetails.tsx'

import type { BaseProps } from '../types.tsx'

export default function BaseCoreDetails(props: BaseProps) {
  const { title = 'Primary data' } = props
  return (
    <BaseCard {...props} title={title}>
      <CoreDetails {...props} />
    </BaseCard>
  )
}
