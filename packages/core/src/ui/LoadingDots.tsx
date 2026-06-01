import { dot1, dot2, dot3 } from './loadingDotKeyframes.ts'
import { makeStyles } from '../util/tss-react/index.ts'

const useStyles = makeStyles()({
  dots: {
    display: 'inline-block',
    width: '1em',
    textAlign: 'left',
    '& span': {
      visibility: 'hidden',
      '&:nth-of-type(1)': {
        animation: `${dot1} 1.2s infinite`,
      },
      '&:nth-of-type(2)': {
        animation: `${dot2} 1.2s infinite`,
      },
      '&:nth-of-type(3)': {
        animation: `${dot3} 1.2s infinite`,
      },
    },
  },
})

export default function LoadingDots() {
  const { classes } = useStyles()
  return (
    <span className={classes.dots}>
      <span>.</span>
      <span>.</span>
      <span>.</span>
    </span>
  )
}
