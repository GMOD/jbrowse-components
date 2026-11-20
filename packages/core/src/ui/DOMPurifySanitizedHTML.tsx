import { useLayoutEffect, useRef } from 'react'

import dompurify from 'dompurify'
import { observer } from 'mobx-react'

import { rewriteAnchors } from './rewriteAnchors.ts'

const DOMPurifySanitizedHTML = observer(function DOMPurifySanitizedHTML({
  value,
  unlink,
  className,
}: {
  value: string
  unlink: boolean
  className?: string
}) {
  const spanRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const el = spanRef.current
    if (el) {
      rewriteAnchors(el, unlink)
    }
  }, [value, unlink])

  return (
    <span
      ref={spanRef}
      className={className}
      // eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml
      dangerouslySetInnerHTML={{ __html: dompurify.sanitize(value) }}
    />
  )
})

export default DOMPurifySanitizedHTML
