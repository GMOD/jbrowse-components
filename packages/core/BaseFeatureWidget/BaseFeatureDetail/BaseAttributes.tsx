import Attributes from './Attributes'
import BaseCard from './BaseCard'

import type { BaseCardProps, BaseProps } from '../types'

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
