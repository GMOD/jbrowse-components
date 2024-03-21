import React from 'react'
import { Typography, TypographyProps } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { keyframes } from 'tss-react'

const useStyles = makeStyles()({
  dots: {
    '&::after': {
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
      content: '""',
      display: 'inline-block',
      textAlign: 'left',
      width: '1em',
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
      {`${message || 'Loading'}`}
    </Typography>
  )
}
