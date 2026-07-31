import { Button } from '@mui/material'

import { useCopyToClipboard } from './useCopyToClipboard.ts'

import type { ButtonProps } from '@mui/material'

/**
 * A Button that copies `value` to the clipboard and briefly swaps its label to
 * `copiedLabel` as feedback. `value` may be a function so callers can defer
 * computing large strings (e.g. JSON.stringify) until the click happens.
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
  const { copied, copy } = useCopyToClipboard()
  return (
    <Button
      {...rest}
      onClick={() => {
        void copy(typeof value === 'function' ? value() : value)
      }}
    >
      {copied ? copiedLabel : children}
    </Button>
  )
}
