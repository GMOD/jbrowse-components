import { render, screen } from '@testing-library/react'

import {
  PaletteProvider,
  SessionPaletteProvider,
  usePalette,
} from './PaletteContext.tsx'
import { resolvePalette } from './palette.ts'

import type { JBrowsePalette } from './palette.ts'

// The smallest thing a session has to be for the two theme entry points: a
// palette to hand out, and a mode write that changes it. Duck-typed, like
// `ThemeModeSession` itself.
function fakeSession() {
  const modes: ('light' | 'dark')[] = []
  const session = {
    mode: 'light' as 'light' | 'dark',
    setThemeMode(mode: 'light' | 'dark') {
      modes.push(mode)
      session.mode = mode
    },
    get palette(): JBrowsePalette {
      return resolvePalette({
        configTheme: { palette: { mode: session.mode } },
      })
    },
  }
  return { session, modes }
}

const ReadsPalette = function ReadsPalette() {
  return <span data-testid="bg">{usePalette().background.default}</span>
}

// The whole reason this is a component rather than two documented calls: the
// session write is what reaches the RPC worker's baked feature labels, and a
// host that mounts `PaletteProvider` on a palette from somewhere else drops it
// with nothing to show for it. So the write is the assertion, not the colors.
test('SessionPaletteProvider writes the mode and provides what comes back', () => {
  const { session, modes } = fakeSession()
  const { rerender } = render(
    <SessionPaletteProvider session={session} mode="dark">
      <ReadsPalette />
    </SessionPaletteProvider>,
  )
  expect(modes).toEqual(['dark'])
  const dark = screen.getByTestId('bg').textContent

  rerender(
    <SessionPaletteProvider session={session} mode="light">
      <ReadsPalette />
    </SessionPaletteProvider>,
  )
  expect(modes).toEqual(['dark', 'light'])
  expect(screen.getByTestId('bg').textContent).not.toBe(dark)
})

test('PaletteProvider alone leaves the session mode untouched', () => {
  const { session, modes } = fakeSession()
  render(
    <PaletteProvider
      palette={resolvePalette({ configTheme: { palette: { mode: 'dark' } } })}
    >
      <ReadsPalette />
    </PaletteProvider>,
  )
  expect(modes).toEqual([])
  expect(session.mode).toBe('light')
})
