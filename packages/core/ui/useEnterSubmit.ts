import { useEffect, useRef } from 'react'

/**
 * Hook that triggers a callback when Enter is pressed (without Shift).
 * Useful for dialogs with Submit buttons to allow Enter-to-submit.
 *
 * @param onSubmit - The callback to trigger when Enter is pressed
 */
export default function useEnterSubmit(onSubmit: () => void) {
  const submitRef = useRef<() => void>()
  submitRef.current = onSubmit

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        submitRef.current?.()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])
}
