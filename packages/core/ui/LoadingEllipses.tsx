import { Typography } from '@mui/material'
import { cx, keyframes, makeStyles } from '@jbrowse/core/util/tss-react'

import type { TypographyProps } from '@mui/material'

const useStyles = makeStyles()({
  dots: {
    '&::after': {
      display: 'inline-block',
      content: '""',
      width: '1em',
      textAlign: 'left',
      animation: `${keyframes`
      0% {
        content: '';
      }
      25% {
          content: '.';
      }
      50% {
        content: '..';
      }
      75% {
        content: '...';
      }
      `} 1.2s infinite ease-in-out`,
    },
  },
})

interface Props extends TypographyProps {
  message?: string
  children?: never
}

export default function LoadingEllipses({
  message,
  children,
  variant = 'body2',
  ...rest
}: Props) {
  const { classes } = useStyles()
  return (
    <Typography
      className={cx(classes.dots, rest.className)}
      {...rest}
      variant={variant}
    >
      {message || 'Loading'}
    </Typography>
  )
}
