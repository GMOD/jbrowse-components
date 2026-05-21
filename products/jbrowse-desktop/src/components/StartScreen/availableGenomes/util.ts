import { useEffect, useState } from 'react'

export function useInnerDims() {
  const [height, setHeight] = useState(window.innerHeight)

  useEffect(() => {
    const update = () => {
      setHeight(window.innerHeight)
    }
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('resize', update)
    }
  }, [])

  return { height }
}
