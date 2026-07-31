import Attributes from './Attributes.tsx'
import BaseCard from './BaseCard.tsx'

import type { BaseProps } from '../types.tsx'

export default function BaseAttributes(props: BaseProps) {
  const { title = 'Attributes', defaultExpanded, feature } = props
  return (
    <BaseCard title={title} defaultExpanded={defaultExpanded}>
      <Attributes {...props} attributes={feature} />
    </BaseCard>
  )
}
