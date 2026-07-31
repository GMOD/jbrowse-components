import { useEffect, useRef, useState } from 'react'

import copyToClipboard from '../util/copyToClipboard.ts'

/**
 * Copy to the clipboard and briefly flash a "copied" confirmation. Returns the
 * flag to render that confirmation from and the copy function to call from a
 * click handler.
 *
 * The timer is what this exists for: it has to be reset on each copy, so a
 * second click doesn't revert the label early, and cleared on unmount, so a
 * panel closed mid-flash leaves nothing pending. `CopyToClipboardButton` and the
 * feature-details `Formatter` had each grown a version of it, one of them
 * without the unmount cleanup.
 */
export function useCopyToClipboard(durationMs = 1000) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(
    () => () => {
      clearTimeout(timerRef.current)
    },
    [],
  )
  return {
    copied,
    // plain text only: a rich `text/html` copy is a menu action with no label to
    // flash, so it calls copyToClipboard directly.
    // The confirmation is flashed only once the write has actually landed —
    // there is no session to notify from an inline button, so a failure leaves
    // the label alone rather than claiming a copy that didn't happen.
    copy: async (text: string) => {
      try {
        await copyToClipboard(text)
        setCopied(true)
        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          setCopied(false)
        }, durationMs)
      } catch (e) {
        console.error(e)
      }
    },
  }
}
