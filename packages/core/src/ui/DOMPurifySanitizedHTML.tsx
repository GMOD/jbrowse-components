import { useLayoutEffect, useRef } from 'react'

import dompurify from 'dompurify'

export default function DOMPurifySanitizedHTML({
  value,
  className,
}: {
  value: string
  className?: string
}) {
  const spanRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const el = spanRef.current
    if (el) {
      for (const a of el.querySelectorAll('a')) {
        a.setAttribute('rel', 'noopener noreferrer')
        a.setAttribute('target', '_blank')
      }
    }
  }, [value])

  return (
    <span
      ref={spanRef}
      className={className}
      // eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml
      dangerouslySetInnerHTML={{ __html: dompurify.sanitize(value) }}
    />
  )
}
