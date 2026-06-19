import { useEffect, useState } from 'react'

import { keyframes, makeStyles } from '@jbrowse/core/util/tss-react'
import { useTheme } from '@mui/material/styles'
import { observer } from 'mobx-react'

import HatchCircle from './HatchCircle.tsx'

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
  const theme = useTheme()

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
    <HatchCircle
      radius={radius}
      fill={theme.palette.action.hover}
      hatchColor={theme.palette.action.disabledBackground}
      text="Loading…"
    >
      <circle
        className={classes.path}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        cx="0"
        cy="0"
        r="60"
      />
    </HatchCircle>
  )
})

export default Loading
