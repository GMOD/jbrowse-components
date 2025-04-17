import { useState } from 'react'

import copy from 'copy-to-clipboard'

// this 'show more...' for long strings
export default function Formatter({ value }: { value: unknown }) {
  const [show, setShow] = useState(false)
  const [copied, setCopied] = useState(false)
  const display = String(value)
  return value ? (
    display.length > 100 ? (
      <>
        <button
          type="button"
          onClick={() => {
            copy(display)
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
  ) : null
}
