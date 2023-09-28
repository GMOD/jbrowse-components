import { useEffect, useRef, useState } from 'react'

export function useResizeBar() {
  const ref = useRef<HTMLDivElement>(null)
  const [scrollLeft, setScrollLeft] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => {
      const elt = ref.current?.querySelector('.MuiDataGrid-virtualScroller')
      if (elt) {
        setScrollLeft(elt.scrollLeft)
      }
    }, 100)
    return () => {
      clearInterval(timer)
    }
  }, [])
  return { ref, scrollLeft }
}
