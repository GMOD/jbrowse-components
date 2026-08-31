import {
  createContext,
  use,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react'

import { defaultStyleTheme } from './styleTheme.ts'

import type { JBrowsePalette } from './palette.ts'
import type { JBrowseStyleTheme } from './styleTheme.ts'
import type { ReactNode } from 'react'

/**
 * How a React component asks for JBrowse's design tokens.
 *
 * This is the toolkit-free counterpart to Material UI's `useTheme`, and it is
 * the seam that lets a display component render without Material UI at all: a
 * display reads `usePalette()` for its content colors, an embedding app
 * supplies them by mounting `PaletteProvider` rather than a `ThemeProvider`,
 * and `makeStyles` reads the whole thing through `useStyleTheme`.
 *
 * JBrowse's own products mount both, from the same session, so the Material UI
 * chrome and the display content cannot disagree.
 *
 * With no provider above it this falls back to the default style theme,
 * mirroring `useTheme`'s fall back to the default theme. That keeps a bare
 * display mountable in a test or a minimal host without ceremony.
 */
const StyleThemeContext = createContext<JBrowseStyleTheme | undefined>(
  undefined,
)

/**
 * Supply the whole style theme — colors plus spacing and type scale. This is
 * what JBrowse's own products mount, from `session.styleTheme`, so a config
 * `theme` that sets `spacing` or `typography` reaches `makeStyles` and Material
 * UI alike.
 */
export function StyleThemeProvider({
  theme,
  children,
}: {
  theme: JBrowseStyleTheme
  children: ReactNode
}) {
  return <StyleThemeContext value={theme}>{children}</StyleThemeContext>
}

/**
 * Supply colors only, leaving JBrowse's default sizing in place. The narrower
 * of the two, and what a host that already holds a palette mounts: it is saying
 * what JBrowse should draw *with*, not restating its type scale.
 *
 * **A host following its own light/dark state wants
 * {@link SessionPaletteProvider} instead**, which is this plus the session
 * write that the worker-side half of the rendering derives from. This one
 * colors React and nothing else.
 */
export function PaletteProvider({
  palette,
  children,
}: {
  palette: JBrowsePalette
  children: ReactNode
}) {
  const theme = useMemo(() => ({ ...defaultStyleTheme, palette }), [palette])
  return <StyleThemeProvider theme={theme}>{children}</StyleThemeProvider>
}

export function useStyleTheme(): JBrowseStyleTheme {
  return use(StyleThemeContext) ?? defaultStyleTheme
}

export function usePalette(): JBrowsePalette {
  return useStyleTheme().palette
}

function darkSchemeQuery() {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : undefined
}

function subscribeToColorScheme(onChange: () => void) {
  const media = darkSchemeQuery()
  media?.addEventListener('change', onChange)
  return () => {
    media?.removeEventListener('change', onChange)
  }
}

function readColorScheme(): 'light' | 'dark' {
  return darkSchemeQuery()?.matches ? 'dark' : 'light'
}

const alwaysLight = () => 'light' as const
const subscribeToNothing = () => () => {}

function useResolvedMode(mode: 'light' | 'dark' | undefined) {
  const systemMode = useSyncExternalStore(
    mode === undefined ? subscribeToColorScheme : subscribeToNothing,
    mode === undefined ? readColorScheme : alwaysLight,
    alwaysLight,
  )
  return mode === undefined ? systemMode : mode
}

/** What {@link useSessionPalette} needs of a session. */
export interface ThemeModeSession {
  setThemeMode: (mode: 'light' | 'dark') => void
  readonly palette: JBrowsePalette
}

/**
 * Point a session at light or dark and get back the palette it resolves to,
 * for a host that wants the palette itself — to read a color out of, or to
 * hand somewhere other than a provider. A host that only wants JBrowse to
 * follow its dark mode mounts {@link SessionPaletteProvider}, which is this
 * hook and the provider in one.
 *
 * How the host knows its own mode is the host's business — an attribute on
 * `<html>`, a design-system context, a toggle in its own state. Pass no mode
 * and JBrowse follows `prefers-color-scheme` instead, tracking OS changes; a
 * host whose mode is only ever the OS preference has nothing to write.
 *
 * **Both halves are load-bearing, which is why the pairing is published as a
 * component.** The palette is what *React* draws with; the config `theme` slot
 * this writes is also what ships to the RPC worker, where feature labels are
 * baked into the rendered image. Mount `PaletteProvider` on a palette from
 * somewhere else and those labels stay in the old mode — light text on a light
 * image, and no error anywhere. `setThemeMode` writes the one slot both are
 * derived from, which is why this returns the palette rather than taking one.
 *
 * The write lands in an effect, so the first paint after a mode change uses
 * the previous palette. That is a frame on a canvas that is about to be
 * redrawn anyway; it is not somewhere to add a suspense boundary.
 */
export function useSessionPalette(
  session: ThemeModeSession,
  mode?: 'light' | 'dark',
): JBrowsePalette {
  const resolved = useResolvedMode(mode)
  useEffect(() => {
    session.setThemeMode(resolved)
  }, [session, resolved])
  return session.palette
}

/**
 * #api
 * Make JBrowse follow the host's light/dark state — the whole of it, in one
 * mount:
 *
 * ```tsx
 * <SessionPaletteProvider session={session} mode={myAppIsDark ? 'dark' : 'light'}>
 *   {tracks}
 * </SessionPaletteProvider>
 * ```
 *
 * `mode` is optional. Left out, JBrowse follows `prefers-color-scheme` and
 * re-themes when the OS preference changes, through the same session write an
 * explicit mode takes — so a host whose dark mode *is* the OS preference mounts
 * this with a session and nothing else. Pass a mode as soon as the host has a
 * toggle of its own, since the media query cannot see it.
 *
 * A component rather than a documented pair of calls because the pair has a
 * half that can be left out with nothing to show for it. `PaletteProvider` is
 * the name a host reaches for, and it colors the React side alone; the session
 * write is what reaches the RPC worker, which bakes feature labels into the
 * rendered image. So a host that mounts only the provider gets light-mode
 * labels on a dark page, from a canvas whose every other pixel is right, and
 * nothing errors. See {@link useSessionPalette} for the mechanism.
 *
 * The session is the only thing that resolves a palette here, so a host
 * supplying colors of its own mounts `PaletteProvider` directly instead.
 */
export function SessionPaletteProvider({
  session,
  mode,
  children,
}: {
  session: ThemeModeSession
  mode?: 'light' | 'dark'
  children: ReactNode
}) {
  const palette = useSessionPalette(session, mode)
  return <PaletteProvider palette={palette}>{children}</PaletteProvider>
}
