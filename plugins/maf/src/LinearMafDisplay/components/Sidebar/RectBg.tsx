import React from 'react'

const RectBg = (props: {
  x: number
  y: number
  width: number
  height: number
  color?: string
}) => {
  const { color = 'rgb(255,255,255,0.5)' } = props
  return <rect {...props} fill={color} />
}

export default RectBg
