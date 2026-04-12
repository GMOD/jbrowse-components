import Attributes from './Attributes.tsx'
import BaseCard from './BaseCard.tsx'

import type { BaseProps } from '../types.tsx'

export default function BaseAttributes(props: BaseProps) {
  const { title = 'Attributes', feature } = props
  return (
    <BaseCard {...props} title={title}>
      <Attributes {...props} attributes={feature} />
    </BaseCard>
  )
}
