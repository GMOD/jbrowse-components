const DARK_SCHEME = '(prefers-color-scheme: dark)'

function darkSchemeQuery() {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function'
    ? window.matchMedia(DARK_SCHEME)
    : undefined
}

/**
 * Whether the OS asks for a dark UI. False wherever `matchMedia` is missing — a
 * worker, jsdom, node — which is the light theme JBrowse has always started in.
 */
export function prefersDarkColorScheme() {
  return darkSchemeQuery()?.matches ?? false
}

/**
 * Call `listener` whenever the OS preference flips, and return the unsubscribe.
 * Both halves live here rather than beside either caller because the session's
 * `system` theme and the embedding hook `useSessionPalette` are two readers of
 * one preference, and a second spelling of the query is a second answer.
 */
export function onColorSchemeChange(listener: () => void) {
  const media = darkSchemeQuery()
  media?.addEventListener('change', listener)
  return () => {
    media?.removeEventListener('change', listener)
  }
}
