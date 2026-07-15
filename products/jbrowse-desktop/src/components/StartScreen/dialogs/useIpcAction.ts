import { useState } from 'react'

export function useIpcAction(action: () => Promise<void>, onClose: () => void) {
  const [error, setError] = useState<unknown>()
  const onSubmit = async () => {
    try {
      await action()
      onClose()
    } catch (e) {
      console.error(e)
      setError(e)
    }
  }
  return { error, onSubmit }
}
