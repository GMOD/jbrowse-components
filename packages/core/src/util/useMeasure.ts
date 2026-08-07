import { useEffect, useRef, useState } from 'react'

/**
 * Element size, via ResizeObserver.
 *
 * `track` names the axes the caller actually uses, and it is a performance knob
 * as much as an API one: the observer fires for a change on *either* axis, so a
 * width-only caller re-rendered every time its content grew taller. That is the
 * common case in a view container, whose height follows its tracks. Naming the
 * axis lets those updates be dropped instead. The unnamed axis is reported as
 * `undefined` rather than a stale number, so nothing can quietly read it.
 */
export default function useMeasure(
  track: 'both' | 'width' | 'height' = 'both',
) {
  const ref = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState<{ width?: number; height?: number }>({
    width: undefined,
    height: undefined,
  })
  useEffect(() => {
    if (!ref.current) {
      return
    }
    const RS =
      typeof window !== 'undefined' && 'ResizeObserver' in window
        ? window.ResizeObserver
        : undefined

    if (!RS) {
      return
    }
    const observer = new RS(entries => {
      const box = entries.at(-1)?.contentBoxSize[0]
      if (box) {
        const width = track === 'height' ? undefined : box.inlineSize
        const height = track === 'width' ? undefined : box.blockSize
        setDims(prev =>
          prev.width === width && prev.height === height
            ? prev
            : { width, height },
        )
      }
    })
    observer.observe(ref.current)
    return () => {
      observer.disconnect()
    }
  }, [track])

  return [ref, dims] as const
}
