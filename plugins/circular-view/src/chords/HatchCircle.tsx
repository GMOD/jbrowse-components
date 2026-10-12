import { useId } from 'react'

import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { observer } from 'mobx-react'

import type { ReactNode } from 'react'

const HatchCircle = observer(function HatchCircle({
  radius,
  fill,
  hatchColor,
  discOpacity = 1,
  textLine = 0,
  text,
  textRotationDeg,
  children,
}: {
  radius: number
  fill: string
  hatchColor: string
  discOpacity?: number
  textLine?: number
  text: ReactNode
  // rotation that undoes the enclosing figure rotation, so the message reads
  // horizontally at any view rotation
  textRotationDeg: number
  children?: ReactNode
}) {
  const palette = usePalette()
  const uniqueId = useId()
  const patternId = `hatch${uniqueId.replaceAll(':', '')}`
  return (
    <g>
      <defs>
        <pattern
          id={patternId}
          width="10"
          height="10"
          patternTransform="rotate(45 0 0)"
          patternUnits="userSpaceOnUse"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="10"
            style={{ stroke: hatchColor, strokeWidth: 10 }}
          />
        </pattern>
      </defs>
      {discOpacity > 0 ? (
        <g opacity={discOpacity}>
          <circle cx="0" cy="0" r={radius} fill={fill} />
          <circle cx="0" cy="0" r={radius} fill={`url(#${patternId})`} />
        </g>
      ) : null}
      <text
        x="0"
        y={`${textLine * 3}em`}
        transform={`rotate(${textRotationDeg} 0 0)`}
        dominantBaseline="middle"
        textAnchor="middle"
        fill={palette.text.primary}
      >
        {text}
      </text>
      {children}
    </g>
  )
})

export default HatchCircle
