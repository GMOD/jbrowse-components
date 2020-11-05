import PluginManager from '@jbrowse/core/PluginManager'

export default (pluginManager: PluginManager) => {
  const { lib } = pluginManager
  const React = lib.react
  const { useState, useEffect } = React
  const { makeStyles } = lib['@material-ui/core/styles']
  const { observer } = lib['mobx-react']

  const useStyles = makeStyles(theme => {
    const offset = 2
    const duration = 1.4
    return {
      path: {
        strokeDasharray: 187,
        strokeDashoffset: 50,
        animation: `$dash ${duration}s ease-in-out infinite, $colors ${
          duration * 4
        }s ease-in-out infinite`,
      },
      '@keyframes colors': {
        '0%': {
          stroke: theme.palette.primary.light,
        },
        '25%': {
          stroke: theme.palette.secondary.light,
        },
        '50%': {
          stroke: theme.palette.tertiary.light,
        },
        '75%': {
          stroke: theme.palette.quaternary.light,
        },
        '100%': {
          stroke: theme.palette.primary.light,
        },
      },
      '@keyframes dash': {
        '0%': {
          strokeDashoffset: offset,
        },
        '50%': {
          strokeDashoffset: offset / 4,
          transform: 'rotate(135deg)',
        },
        '100%': {
          strokeDashoffset: offset,
          transform: 'rotate(720deg)',
        },
      },
    }
  })

  // 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,.5) 5px, rgba(255,255,255,.5) 10px)',
  const Loading = observer(
    ({
      model: {
        renderProps: { radius },
      },
    }: {
      model: { renderProps: { radius: number } }
    }) => {
      const classes = useStyles()

      // only show the loading message after 400ms to prevent excessive flickering
      const [shown, setShown] = useState(false)
      useEffect(() => {
        const timeout = setTimeout(() => setShown(true), 400)
        return () => clearTimeout(timeout)
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
    },
  )

  return Loading
}
