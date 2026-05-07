import { Typography } from '@mui/material'

import { dot1, dot2, dot3 } from './loadingDotKeyframes.ts'
import { makeStyles } from '../util/tss-react/index.ts'

import type { TypographyProps } from '@mui/material'

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

interface Props extends TypographyProps {
  message?: string
  children?: never
}

export default function LoadingEllipses({
  message,
  variant = 'body2',
  ...rest
}: Props) {
  const { classes } = useStyles()
  return (
    <Typography {...rest} variant={variant}>
      {message || 'Loading'}
      <span className={classes.dots}>
        <span>.</span>
        <span>.</span>
        <span>.</span>
      </span>
    </Typography>
  )
}
