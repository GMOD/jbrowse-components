import { useState } from 'react'

import {
  ContextMenu,
  createJBrowseTheme,
  useMouseState,
} from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { act, fireEvent, render, screen } from '@testing-library/react'

import DisplayChrome from './DisplayChrome.tsx'
import { TestChromeModel, stubFactory } from './chromeTestModel.ts'

import type { ContextMenuAnchor, MouseTracker } from '@jbrowse/core/ui'

// A MENU CLOSING OVER A DISPLAY LEAVES NO `mouseleave` BEHIND. The browser
// decides an element was left by comparing the hover chain before a move to the
// chain after it, and a menu portalled to the body opens under the cursor with
// no move at all — then unmounts, detaching the chain it took. Hover restarts
// at `body`, the display is in neither chain, and nothing is dispatched to it
// again however far the pointer goes. Its pointer overlays (crosshairs, the MAF
// per-base tooltip, every `useMouseState` reader) then stay drawn at the
// coordinate the menu opened on. Found by a poster carrying a stale MAF tooltip
// over the payoff.
//
// The clear rides `ContextMenu` rather than each display, because that is the
// one menu every display raises: the chrome publishes its clear and the menu
// calls it on close.

// jsdom's rAF is a timer, so the measurement frame is driven explicitly.
let frames: (() => void)[] = []

beforeEach(() => {
  frames = []
  jest
    .spyOn(globalThis, 'requestAnimationFrame')
    .mockImplementation((cb: FrameRequestCallback) => {
      frames.push(() => {
        cb(0)
      })
      return frames.length
    })
  jest
    .spyOn(globalThis, 'cancelAnimationFrame')
    .mockImplementation((handle: number) => {
      frames[handle - 1] = () => {}
    })
})

afterEach(() => {
  jest.restoreAllMocks()
})

function runFrames() {
  const pending = frames
  frames = []
  for (const frame of pending) {
    act(() => {
      frame()
    })
  }
}

function Body({
  mouseTracker,
  anchor,
  onClose,
}: {
  mouseTracker: MouseTracker
  anchor: ContextMenuAnchor | undefined
  onClose: () => void
}) {
  const mouse = useMouseState(mouseTracker)
  return (
    <>
      <div data-testid="pointer">
        {mouse ? `${mouse.x},${mouse.y}` : 'no pointer'}
      </div>
      <ContextMenu
        anchor={anchor}
        onClose={onClose}
        menuItems={[{ label: 'View subsequences', onClick: () => {} }]}
      />
    </>
  )
}

function setup() {
  const model = TestChromeModel.create({})
  function Harness() {
    const [anchor, setAnchor] = useState<ContextMenuAnchor | undefined>()
    return (
      <ThemeProvider theme={createJBrowseTheme()}>
        <button
          type="button"
          onClick={() => {
            setAnchor({ clientX: 40, clientY: 12 })
          }}
        >
          open the menu
        </button>
        <DisplayChrome
          model={model}
          factory={stubFactory}
          testid="probe-display"
        >
          {({ mouseTracker }) => (
            <Body
              mouseTracker={mouseTracker}
              anchor={anchor}
              onClose={() => {
                setAnchor(undefined)
              }}
            />
          )}
        </DisplayChrome>
      </ThemeProvider>
    )
  }
  render(<Harness />)
  const pointer = () => screen.getByTestId('pointer').textContent
  return {
    pointer,
    move(clientX: number, clientY: number) {
      fireEvent.mouseMove(screen.getByTestId('probe-display'), {
        clientX,
        clientY,
      })
      runFrames()
    },
    openMenu() {
      fireEvent.click(screen.getByText('open the menu'))
    },
  }
}

test('picking an item drops the pointer the menu opened over', () => {
  const { pointer, move, openMenu } = setup()
  move(40, 12)
  expect(pointer()).toBe('40,12')

  openMenu()
  fireEvent.click(screen.getByText('View subsequences'))
  expect(pointer()).toBe('no pointer')
})

// Dismissing without picking detaches the same hover chain, so it owes the same
// clear — `onClose` is `ContextMenu`'s single close path and both arrive on it.
test('dismissing the menu drops it too', () => {
  const { pointer, move, openMenu } = setup()
  move(40, 12)
  openMenu()
  fireEvent.keyDown(screen.getByText('View subsequences'), { key: 'Escape' })
  expect(pointer()).toBe('no pointer')
})

// The clear is not a one-way latch: the display goes on tracking, so a pointer
// that comes back publishes again rather than staying dark until a remount.
test('the display tracks again after the menu has closed', () => {
  const { pointer, move, openMenu } = setup()
  move(40, 12)
  openMenu()
  fireEvent.click(screen.getByText('View subsequences'))
  move(90, 30)
  expect(pointer()).toBe('90,30')
})
