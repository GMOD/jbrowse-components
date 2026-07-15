import { Typography } from '@mui/material'

import LoadingDots from './LoadingDots.tsx'

import type { TypographyProps } from '@mui/material'

interface Props extends TypographyProps {
  message?: string
  children?: never
}

export default function LoadingEllipses({
  message,
  variant = 'body2',
  ...rest
}: Props) {
  return (
    <Typography {...rest} variant={variant}>
      {message || 'Loading'}
      <LoadingDots />
    </Typography>
  )
}
