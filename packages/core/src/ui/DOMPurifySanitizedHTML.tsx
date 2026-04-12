import { useMemo } from 'react'

import dompurify from 'dompurify'

export default function DOMPurifySanitizedHTML({
  value,
  className,
}: {
  value: string
  className?: string
}) {
  const sanitized = useMemo(() => {
    const div = document.createElement('div')
    div.innerHTML = dompurify.sanitize(value)
    for (const a of div.querySelectorAll('a')) {
      a.setAttribute('rel', 'noopener noreferrer')
      a.setAttribute('target', '_blank')
    }
    return div.innerHTML
  }, [value])

  return <span className={className} dangerouslySetInnerHTML={{ __html: sanitized }} />
}
