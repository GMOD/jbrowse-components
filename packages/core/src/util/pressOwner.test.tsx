import { fireEvent, render } from '@testing-library/react'
import { createPortal } from 'react-dom'

import { isClaimedPress, isFromPortal } from './pressOwner.ts'

import type React from 'react'

// A container with one of everything a press can land on, and a portal
// rendered from inside it, which is the case the DOM alone cannot answer:
// React delivers the portal's press to the container's handler.
function setup() {
  const seen: { portal: boolean; claimed: boolean }[] = []
  const { getByTestId } = render(
    <div
      onPointerDown={(event: React.PointerEvent) => {
        seen.push({
          portal: isFromPortal(event),
          claimed: isClaimedPress(event),
        })
      }}
    >
      <div data-testid="canvas" />
      <button>
        <span data-testid="button-icon" />
      </button>
      <div data-gesture-owner="true">
        <span data-testid="owner-icon" />
      </div>
      <div draggable="true">
        <span data-testid="draggable-icon" />
      </div>
      {createPortal(<div data-testid="dialog" />, document.body)}
    </div>,
  )
  return (testid: string) => {
    fireEvent.pointerDown(getByTestId(testid))
    return seen.pop()
  }
}

test('a press on the container itself is its own', () => {
  const press = setup()
  expect(press('canvas')).toEqual({ portal: false, claimed: false })
})

test('a press in a portal reaches the handler and is not the container’s', () => {
  const press = setup()
  expect(press('dialog')).toEqual({ portal: true, claimed: true })
})

test.each(['button-icon', 'owner-icon', 'draggable-icon'])(
  'a press on %s is claimed by the control around it',
  testid => {
    const press = setup()
    expect(press(testid)).toEqual({ portal: false, claimed: true })
  },
)
