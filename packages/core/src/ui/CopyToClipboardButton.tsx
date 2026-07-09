import { useEffect, useRef, useState } from 'react'

import { Button } from '@mui/material'

import copy from '../util/copyToClipboard.ts'

import type { ButtonProps } from '@mui/material'

/**
 * A Button that copies `value` to the clipboard and briefly swaps its label to
 * `copiedLabel` as feedback. `value` may be a function so callers can defer
 * computing large strings (e.g. JSON.stringify) until the click happens. The
 * feedback timer is reset on each click and cleared on unmount, so repeated
 * clicks don't make the label flicker back early.
 */
export default function CopyToClipboardButton({
  value,
  children,
  copiedLabel = 'Copied to clipboard!',
  ...rest
}: {
  value: string | (() => string)
  copiedLabel?: string
} & Omit<ButtonProps, 'value'>) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(
    () => () => {
      clearTimeout(timerRef.current)
    },
    [],
  )
  return (
    <Button
      {...rest}
      onClick={() => {
        void copy(typeof value === 'function' ? value() : value)
        setCopied(true)
        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          setCopied(false)
        }, 1000)
      }}
    >
      {copied ? copiedLabel : children}
    </Button>
  )
}
