import { createContext, useContext, useEffect, useMemo } from 'react'

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
  return (
    <StyleThemeContext.Provider value={theme}>
      {children}
    </StyleThemeContext.Provider>
  )
}

/**
 * Supply colors only, leaving JBrowse's default sizing in place. The narrower
 * of the two and the one an embedding app wants: a host mounting this is saying
 * what JBrowse should draw *with*, not restating its type scale.
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
  return useContext(StyleThemeContext) ?? defaultStyleTheme
}

export function usePalette(): JBrowsePalette {
  return useStyleTheme().palette
}

/** What {@link useSessionPalette} needs of a session. */
export interface ThemeModeSession {
  setThemeMode: (mode: 'light' | 'dark') => void
  readonly palette: JBrowsePalette
}

/**
 * Point a session at light or dark and get back the palette it resolves to,
 * for a host following its own dark-mode state. Feed the result to
 * `PaletteProvider`:
 *
 * ```tsx
 * const palette = useSessionPalette(session, myAppIsDark ? 'dark' : 'light')
 * return <PaletteProvider palette={palette}>{tracks}</PaletteProvider>
 * ```
 *
 * How the host knows its own mode is the host's business — an attribute on
 * `<html>`, a `prefers-color-scheme` media query, a design-system context —
 * and deliberately not this hook's.
 *
 * **Reaching for `PaletteProvider` alone is the trap this exists to close.**
 * The palette is what *React* draws with; the config `theme` slot is also what
 * ships to the RPC worker, where feature labels are baked into the rendered
 * image. Supply only the first and those labels stay in the old mode — light
 * text on a light image, and no error anywhere. `setThemeMode` writes the one
 * slot both are derived from, which is why this returns the palette rather
 * than taking one.
 *
 * The write lands in an effect, so the first paint after a mode change uses
 * the previous palette. That is a frame on a canvas that is about to be
 * redrawn anyway; it is not somewhere to add a suspense boundary.
 */
export function useSessionPalette(
  session: ThemeModeSession,
  mode: 'light' | 'dark',
): JBrowsePalette {
  useEffect(() => {
    session.setThemeMode(mode)
  }, [session, mode])
  return session.palette
}
