import { observer } from 'mobx-react'

import BaseCard from './BaseCard.tsx'
import CoreDetails from './CoreDetails.tsx'

import type { BaseProps } from '../types.tsx'

const BaseCoreDetails = observer(function BaseCoreDetails(props: BaseProps) {
  const { title = 'Primary data', defaultExpanded } = props
  return (
    <BaseCard title={title} defaultExpanded={defaultExpanded}>
      <CoreDetails {...props} />
    </BaseCard>
  )
})

export default BaseCoreDetails
