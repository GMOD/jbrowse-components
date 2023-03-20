import { useRef } from 'react'

export default function useMeasure() {
  const ref = useRef<HTMLDivElement>(null)
  return [ref, { width: 808 }] as const
}
