import { useId } from 'react'

import { observer } from 'mobx-react'

const DisplayError = observer(function DisplayError({
  model,
  radius,
}: {
  model: { error: unknown }
  radius: number
}) {
  const uid = useId()
  // useId returns ':r0:' format; strip colons for valid SVG/CSS fragment identifiers
  const patternId = `hatch${uid.replace(/:/g, '')}`
  const { error } = model
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
            style={{ stroke: 'rgba(255,0,0,0.5)', strokeWidth: 10 }}
          />
        </pattern>
      </defs>
      <circle cx="0" cy="0" r={radius} fill="#ffb4b4" />
      <circle cx="0" cy="0" r={radius} fill={`url(#${patternId})`} />
      <text
        x="0"
        y="0"
        transform="rotate(90 0 0)"
        dominantBaseline="middle"
        textAnchor="middle"
      >
        {String(error)}
      </text>
    </g>
  )
})

export default DisplayError
