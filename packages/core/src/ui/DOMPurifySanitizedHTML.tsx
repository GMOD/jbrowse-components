import { useLayoutEffect, useRef } from 'react'

import dompurify from 'dompurify'
import { observer } from 'mobx-react'

import { rewriteExternalAnchors } from './rewriteExternalAnchors.ts'

const DOMPurifySanitizedHTML = observer(function DOMPurifySanitizedHTML({
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
      rewriteExternalAnchors(el)
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
})

export default DOMPurifySanitizedHTML
