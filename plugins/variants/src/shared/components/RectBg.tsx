import { getFillProps } from '@jbrowse/core/util'

const RectBg = ({
  x,
  y,
  width,
  height,
  color = 'rgba(255,255,255,0.5)',
}: {
  x: number
  y: number
  width: number
  height: number
  color?: string
}) => {
  return (
    <rect
      pointerEvents="auto"
      x={x}
      y={y}
      width={width}
      height={height}
      {...getFillProps(color)}
    />
  )
}

export default RectBg
