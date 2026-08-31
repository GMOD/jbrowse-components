import { act, render, screen } from '@testing-library/react'

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

// jsdom ships no matchMedia at all, which is also the environment the provider
// guards for, so the query is installed per-test and removed after.
class FakeMediaQueryList extends EventTarget implements MediaQueryList {
  readonly media = '(prefers-color-scheme: dark)'
  onchange = null
  subscriptions = 0

  constructor(public matches: boolean) {
    super()
  }

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ) {
    this.subscriptions++
    super.addEventListener(type, listener, options)
  }

  addListener() {}
  removeListener() {}

  setMatches(matches: boolean) {
    this.matches = matches
    this.dispatchEvent(new Event('change'))
  }
}

function installMatchMedia(matches: boolean) {
  const media = new FakeMediaQueryList(matches)
  window.matchMedia = (query: string) => {
    expect(query).toBe('(prefers-color-scheme: dark)')
    return media
  }
  return media
}

afterEach(() => {
  Reflect.deleteProperty(window, 'matchMedia')
})

test('no mode follows prefers-color-scheme, and its changes', () => {
  const media = installMatchMedia(true)
  const { session, modes } = fakeSession()
  render(
    <SessionPaletteProvider session={session}>
      <ReadsPalette />
    </SessionPaletteProvider>,
  )
  expect(modes).toEqual(['dark'])
  const dark = screen.getByTestId('bg').textContent

  act(() => {
    media.setMatches(false)
  })
  expect(modes).toEqual(['dark', 'light'])
  expect(screen.getByTestId('bg').textContent).not.toBe(dark)
})

test('an explicit mode ignores the media query and subscribes to nothing', () => {
  const media = installMatchMedia(true)
  const { session, modes } = fakeSession()
  render(
    <SessionPaletteProvider session={session} mode="light">
      <ReadsPalette />
    </SessionPaletteProvider>,
  )
  expect(modes).toEqual(['light'])
  expect(media.subscriptions).toBe(0)

  act(() => {
    media.setMatches(false)
  })
  expect(modes).toEqual(['light'])
})

test('no mode without matchMedia is light', () => {
  const { session, modes } = fakeSession()
  render(
    <SessionPaletteProvider session={session}>
      <ReadsPalette />
    </SessionPaletteProvider>,
  )
  expect(modes).toEqual(['light'])
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
