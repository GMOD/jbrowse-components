import { useState } from 'react'

import { useCopyToClipboard } from '../../ui/useCopyToClipboard.ts'

const TRUNCATE_LENGTH = 100

// a 'show more...' toggle used as a formatter on feature details: long values
// (e.g. a SEQ/CRAM string, or a long read's worth of data in a single div) can
// slow down the rest of the app, so they are truncated until expanded
export default function Formatter({ value }: { value: unknown }) {
  const [show, setShow] = useState(false)
  const { copied, copy } = useCopyToClipboard(700)
  const display = String(value)
  return display.length > TRUNCATE_LENGTH ? (
    <>
      <button
        type="button"
        onClick={() => {
          void copy(display)
        }}
      >
        {copied ? 'Copied to clipboard' : 'Copy'}
      </button>
      <button
        type="button"
        onClick={() => {
          setShow(val => !val)
        }}
      >
        {show ? 'Show less' : 'Show more'}
      </button>
      <div>{show ? display : `${display.slice(0, TRUNCATE_LENGTH)}...`}</div>
    </>
  ) : (
    <div>{display}</div>
  )
}
