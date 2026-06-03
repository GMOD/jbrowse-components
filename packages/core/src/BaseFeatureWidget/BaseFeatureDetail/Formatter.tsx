import { useState } from 'react'

// a 'show more...' toggle used as a formatter on feature details: long values
// (e.g. a SEQ/CRAM string, or a long read's worth of data in a single div) can
// slow down the rest of the app, so they are truncated until expanded
export default function Formatter({ value }: { value: unknown }) {
  const [show, setShow] = useState(false)
  const [copied, setCopied] = useState(false)
  const display = String(value)
  return display.length > 100 ? (
    <>
      <button
        type="button"
        onClick={async () => {
          const { default: copy } =
            await import('../../util/copyToClipboard.ts')
          void copy(display)
          setCopied(true)
          setTimeout(() => {
            setCopied(false)
          }, 700)
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
      <div>{show ? display : `${display.slice(0, 100)}...`}</div>
    </>
  ) : (
    <div>{display}</div>
  )
}
