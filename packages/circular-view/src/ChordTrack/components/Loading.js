export default ({ jbrequire }) => {
  const React = jbrequire('react')
  const { useState, useEffect } = React
  const { makeStyles } = jbrequire('@material-ui/core/styles')
  const { observer } = jbrequire('mobx-react')

  const useStyles = makeStyles({
    loadingMessage: {},
    loadingBackground: {},
    loadingText: {},
  })

  // 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,.5) 5px, rgba(255,255,255,.5) 10px)',
  const Loading = observer(
    ({
      model: {
        renderProps: { radius },
      },
    }) => {
      const classes = useStyles()

      // only show the loading message after 400ms to prevent excessive flickering
      const [shown, setShown] = useState(false)
      useEffect(() => {
        const timeout = setTimeout(() => setShown(true), 400)
        return () => clearTimeout(timeout)
      })

      return !shown ? null : (
        <>
          <g className={classes.loadingMessage}>
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
            <circle
              className={classes.loadingBackground}
              cx="0"
              cy="0"
              r={radius}
              fill="#f1f1f1"
            />
            <circle
              className={classes.loadingPattern}
              cx="0"
              cy="0"
              r={radius}
              fill="url(#diagonalHatch)"
            />
            <text
              className={classes.loadingText}
              x="0"
              y="0"
              transform="rotate(90 0 0)"
              dominantBaseline="middle"
              textAnchor="middle"
            >
              Loading&hellip;
            </text>
            <circle
              className="path"
              fill="none"
              strokeWidth="4"
              strokeLinecap="round"
              cx="0"
              cy="0"
              r="60"
            />
          </g>
        </>
      )
    },
  )

  return Loading
}
