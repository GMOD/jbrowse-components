import { getFillProps } from '@jbrowse/core/util'

const RectBg = (props: {
  x: number
  y: number
  width: number
  height: number
  color?: string
}) => {
  const { color = 'rgba(255,255,255,0.5)' } = props
  return <rect pointerEvents="auto" {...props} {...getFillProps(color)} />
}

export default RectBg
