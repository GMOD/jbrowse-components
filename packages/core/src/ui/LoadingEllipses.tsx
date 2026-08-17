import { Typography } from '@mui/material'

import LoadingDots from './LoadingDots.tsx'

import type { TypographyProps } from '@mui/material'

interface Props extends TypographyProps {
  message?: string
  children?: never
}

/**
 * The label every part of the app shows while it is working, and — through
 * `data-busy` — the only thing an automated capture has to look at to know that
 * it is.
 *
 * The attribute is the contract that replaces reading the label. A harness
 * waiting for a page to finish used to scan visible text for /^loading/ and
 * resolve `getComputedStyle` to decide whether each match was on screen, which
 * makes a rendering detail load-bearing: a reworded message, a translation, or
 * an element that animates its opacity all change the answer. `[data-busy]` is
 * published by the component that knows, so a wait is one selector.
 *
 * Anything that renders its own in-flight banner instead of this component
 * should carry the attribute too — see `isPageBusyInPage` in
 * `@jbrowse/capture`, which is what reads it.
 */
export default function LoadingEllipses({
  message,
  variant = 'body2',
  ...rest
}: Props) {
  return (
    <Typography {...rest} variant={variant} data-busy="true">
      {message || 'Loading'}
      <LoadingDots />
    </Typography>
  )
}
