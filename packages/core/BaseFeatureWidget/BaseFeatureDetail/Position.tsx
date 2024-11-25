import React from 'react'
import { assembleLocString } from '../../util'
import type { BaseProps } from '../types'

export default function Position(props: BaseProps) {
  const { feature } = props
  const strand = feature.strand as number
  const strandMap: Record<string, string> = {
    '-1': '-',
    '0': '',
    '1': '+',
  }
  const str = strandMap[strand] ? `(${strandMap[strand]})` : ''
  const loc = assembleLocString(feature)
  return <>{`${loc} ${str}`}</>
}
