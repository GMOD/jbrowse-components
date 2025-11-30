import { type ReactNode, useEffect, useRef, useState } from 'react'

export default function AutoSizer({
  children,
  disableWidth,
}: {
  children: (size: { height: number; width: number }) => ReactNode
  disableWidth?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    const parent = ref.current?.parentElement
    if (!parent) {
      return
    }
    const observer = new ResizeObserver(() => {
      const style = window.getComputedStyle(parent)
      const rect = parent.getBoundingClientRect()
      setHeight(
        rect.height -
          parseFloat(style.paddingTop) -
          parseFloat(style.paddingBottom),
      )
    })
    observer.observe(parent)
    return () => {
      observer.disconnect()
    }
  }, [])

  return (
    <div
      ref={ref}
      style={{ height: disableWidth ? 0 : undefined, overflow: 'visible' }}
    >
      {height > 0 ? children({ height, width: 0 }) : null}
    </div>
  )
}
