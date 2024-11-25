import React from 'react'
import { Typography } from '@mui/material'
import { keyframes } from 'tss-react'
import { makeStyles } from 'tss-react/mui'
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
}

export default function LoadingEllipses({
  message,
  variant = 'body2',
  ...rest
}: Props) {
  const { classes } = useStyles()
  return (
    <Typography className={classes.dots} {...rest} variant={variant}>
      {message || 'Loading'}
    </Typography>
  )
}
