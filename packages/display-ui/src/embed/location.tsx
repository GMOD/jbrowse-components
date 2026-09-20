import { useRef, useState } from 'react'

import { observer } from 'mobx-react'

import type React from 'react'

export interface LocationView {
  coarseVisibleLocStrings: string
  navToLocString: (input: string) => Promise<unknown>
}

export function useLocationBox(view: LocationView) {
  const [draft, setDraft] = useState<string>()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>()
  const requests = useRef(0)
  const value = draft ?? view.coarseVisibleLocStrings
  return {
    value,
    pending,
    error,
    edit(text: string) {
      setDraft(text)
    },
    reset() {
      setDraft(undefined)
      setError(undefined)
    },
    go(input = value) {
      const request = ++requests.current
      const isLatest = () => request === requests.current
      setDraft(input)
      setError(undefined)
      setPending(true)
      view
        .navToLocString(input)
        .then(() => {
          if (isLatest()) {
            setDraft(undefined)
          }
        })
        .catch((e: unknown) => {
          if (isLatest()) {
            setError(e)
          }
        })
        .finally(() => {
          if (isLatest()) {
            setPending(false)
          }
        })
    },
  }
}

export const LocationBox = observer(function LocationBox({
  view,
  style,
}: {
  view: LocationView
  style?: React.CSSProperties
}) {
  const box = useLocationBox(view)
  return (
    <form
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 4,
        ...style,
      }}
      onSubmit={event => {
        event.preventDefault()
        box.go()
      }}
    >
      <input
        aria-label="Location"
        value={box.value}
        size={38}
        style={{ font: 'inherit', padding: '2px 4px' }}
        onChange={event => {
          box.edit(event.target.value)
        }}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            box.reset()
          }
        }}
      />
      <button type="submit" disabled={box.pending} style={{ font: 'inherit' }}>
        Go
      </button>
      {box.error ? (
        <span role="alert">
          {box.error instanceof Error ? box.error.message : String(box.error)}
        </span>
      ) : null}
    </form>
  )
})
