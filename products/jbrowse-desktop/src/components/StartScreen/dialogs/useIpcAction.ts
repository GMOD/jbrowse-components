import { useRef, useState } from 'react'

export function useIpcAction(action: () => Promise<void>, onClose: () => void) {
  const [error, setError] = useState<unknown>()
  // a slow action (loading a link's config, say) leaves the dialog sitting there
  // with a live submit button, and each extra press runs the action again
  const [pending, setPending] = useState(false)
  // `pending` re-renders the button as disabled, but a second press landing
  // before that render would still get through, so latch synchronously here
  const inFlightRef = useRef(false)
  const onSubmit = async () => {
    if (!inFlightRef.current) {
      inFlightRef.current = true
      setPending(true)
      try {
        await action()
        onClose()
      } catch (e) {
        console.error(e)
        setError(e)
      } finally {
        inFlightRef.current = false
        setPending(false)
      }
    }
  }
  return { error, pending, onSubmit }
}
