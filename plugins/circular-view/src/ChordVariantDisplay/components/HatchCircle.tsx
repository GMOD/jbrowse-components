import { useId } from 'react'
import type { ReactNode } from 'react'

import { observer } from 'mobx-react'

const HatchCircle = observer(function HatchCircle({
  radius,
  fill,
  hatchColor,
  text,
  children,
}: {
  radius: number
  fill: string
  hatchColor: string
  text: ReactNode
  children?: ReactNode
}) {
  const uniqueId = useId()
  const patternId = `hatch${uniqueId.replace(/:/g, '')}`
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
      <circle cx="0" cy="0" r={radius} fill={fill} />
      <circle cx="0" cy="0" r={radius} fill={`url(#${patternId})`} />
      <text
        x="0"
        y="0"
        transform="rotate(90 0 0)"
        dominantBaseline="middle"
        textAnchor="middle"
      >
        {text}
      </text>
      {children}
    </g>
  )
})

export default HatchCircle
