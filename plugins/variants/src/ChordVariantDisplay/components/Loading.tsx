import { useEffect, useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

const useStyles = makeStyles()(() => {
  const duration = 1.4

  return {
    path: {
      strokeDasharray: 187,
      strokeDashoffset: 50,
      animation: `$dash ${duration}s ease-in-out infinite, $colors ${
        duration * 4
      }s ease-in-out infinite`,
    },
  }
})

const Loading = observer(function ({
  model: {
    renderProps: { radius },
  },
}: {
  model: { renderProps: { radius: number } }
}) {
  const { classes } = useStyles()

  // only show the loading message after 400ms to prevent excessive flickering
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const timeout = setTimeout(() => {
      setShown(true)
    }, 400)
    return () => {
      clearTimeout(timeout)
    }
  })

  return !shown ? null : (
    <g>
      <defs>
        <pattern
          id="diagonalHatch"
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
      <circle cx="0" cy="0" r={radius} fill="url(#diagonalHatch)" />
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
