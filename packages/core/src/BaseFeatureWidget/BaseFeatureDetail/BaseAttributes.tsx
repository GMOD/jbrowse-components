import Attributes from './Attributes.tsx'
import BaseCard from './BaseCard.tsx'

import type { BaseCardProps, BaseProps } from '../types.tsx'

export interface BaseInputProps extends BaseCardProps {
  omit?: string[]
  model: any
  descriptions?: Record<string, React.ReactNode>
  formatter?: (val: unknown, key: string) => React.ReactNode
}

export default function BaseAttributes(props: BaseProps) {
  const { title = 'Attributes', feature } = props
  return (
    <BaseCard {...props} title={title}>
      <Attributes {...props} attributes={feature} />
    </BaseCard>
  )
}
