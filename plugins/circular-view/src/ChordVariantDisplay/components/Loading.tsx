import { useEffect, useId, useState } from 'react'

import { keyframes, makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

const duration = 1.4

const dash = keyframes({
  '0%': { strokeDashoffset: 187 },
  '50%': { strokeDashoffset: 46 },
  '100%': { strokeDashoffset: 187 },
})

const colors = keyframes({
  '0%, 100%': { stroke: '#4285f4' },
  '25%': { stroke: '#de3e35' },
  '50%': { stroke: '#f7c223' },
  '75%': { stroke: '#1b9a59' },
})

const useStyles = makeStyles()(() => ({
  path: {
    strokeDasharray: 187,
    strokeDashoffset: 50,
    animation: `${dash} ${duration}s ease-in-out infinite, ${colors} ${duration * 4}s ease-in-out infinite`,
  },
}))

const Loading = observer(function Loading({ radius }: { radius: number }) {
  const { classes } = useStyles()
  const uid = useId()
  // useId returns ':r0:' format; strip colons for valid SVG/CSS fragment identifiers
  const patternId = `hatch${uid.replace(/:/g, '')}`

  // only show the loading message after 400ms to prevent excessive flickering
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const timeout = setTimeout(() => {
      setShown(true)
    }, 400)
    return () => {
      clearTimeout(timeout)
    }
  }, [])

  return !shown ? null : (
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
            style={{ stroke: 'rgba(255,255,255,0.5)', strokeWidth: 10 }}
          />
        </pattern>
      </defs>
      <circle cx="0" cy="0" r={radius} fill="#f1f1f1" />
      <circle cx="0" cy="0" r={radius} fill={`url(#${patternId})`} />
      <text
        x="0"
        y="0"
        transform="rotate(90 0 0)"
        dominantBaseline="middle"
        textAnchor="middle"
      >
        Loading&hellip;
      </text>
      <circle
        className={classes.path}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        cx="0"
        cy="0"
        r="60"
      />
    </g>
  )
})

export default Loading
