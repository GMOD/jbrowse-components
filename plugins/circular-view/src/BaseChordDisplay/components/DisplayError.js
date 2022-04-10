import React from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from '@mui/styles'

const useStyles = makeStyles({
  errorMessage: {},
  errorBackground: {},
  errorText: {},
})

// 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,.5) 5px, rgba(255,255,255,.5) 10px)',
const DisplayError = observer(
  ({
    model: {
      renderProps: { radius },
      error,
    },
  }) => {
    const classes = useStyles()
    return (
      <g className={classes.errorMessage}>
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
              style={{ stroke: 'rgba(255,0,0,0.5)', strokeWidth: 10 }}
            />
          </pattern>
        </defs>
        <circle
          className={classes.errorBackground}
          cx="0"
          cy="0"
          r={radius}
          fill="#ffb4b4"
        />
        <circle
          className={classes.errorPattern}
          cx="0"
          cy="0"
          r={radius}
          fill="url(#diagonalHatch)"
        />
        <text
          className={classes.errorText}
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
  },
)

export default DisplayError
