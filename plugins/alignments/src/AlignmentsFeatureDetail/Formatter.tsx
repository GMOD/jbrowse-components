import React, { useState } from 'react'
import copy from 'copy-to-clipboard'

// this 'show more...' used specifically as a formatter on alignments feature
// details because long SEQ or CRAM files, even a single div full of a ton of
// data from a long read, can slow down the rest of the app
export default function Formatter({ value }: { value: unknown }) {
  const [show, setShow] = useState(false)
  const [copied, setCopied] = useState(false)
  const display = String(value)
  return display.length > 100 ? (
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
}
