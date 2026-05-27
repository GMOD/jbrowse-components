import { useRef } from 'react'

// Returns a ref that always points to the latest value. Useful inside long-
// lived effects (e.g. global mouse listeners) that need to read current state
// without re-registering when it changes.
export default function useLatestRef<T>(value: T) {
  const ref = useRef(value)
  // eslint-disable-next-line react-hooks/refs
  ref.current = value
  return ref
}
