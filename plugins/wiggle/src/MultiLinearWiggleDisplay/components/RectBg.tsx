import { getFillProps } from '@jbrowse/core/util'
import React from 'react'

const RectBg = (props: {
  x: number
  y: number
  width: number
  height: number
  color?: string
}) => {
  const { color = 'rgb(255,255,255,0.8)' } = props
  return <rect {...props} {...getFillProps(color)} />
}

export default RectBg
