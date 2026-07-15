import { useState } from 'react'

import { act, fireEvent, render, screen } from '@testing-library/react'

import { useEventCallback } from './useEventCallback.ts'

// The contract: the returned callback is referentially stable across renders,
// yet always invokes the latest `fn` (reads the latest closure values). This is
// what makes it a safe replacement for useEffectEvent — see
// key_pattern_useeffectevent_observer_hazard.
test('stable identity, reads latest state', () => {
  const identities = new Set<unknown>()
  const seen: number[] = []

  function Comp() {
    const [count, setCount] = useState(0)
    const cb = useEventCallback(() => {
      seen.push(count)
    })
    identities.add(cb)
    return (
      <div>
        <button
          data-testid="inc"
          onClick={() => {
            setCount(c => c + 1)
          }}
        />
        <button
          data-testid="read"
          onClick={() => {
            cb()
          }}
        />
      </div>
    )
  }

  render(<Comp />)
  const inc = screen.getByTestId('inc')
  const read = screen.getByTestId('read')

  act(() => {
    fireEvent.click(read)
  })
  act(() => {
    fireEvent.click(inc)
  })
  act(() => {
    fireEvent.click(inc)
  })
  act(() => {
    fireEvent.click(read)
  })

  // latest closure value observed both times, not the value captured at mount
  expect(seen).toEqual([0, 2])
  // exactly one stable callback identity across all the re-renders
  expect(identities.size).toBe(1)
})
