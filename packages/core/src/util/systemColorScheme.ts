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

const DARK_READER_ATTRIBUTE = 'data-darkreader-scheme'

/**
 * Whether the Dark Reader extension is darkening the page in its Dynamic mode,
 * which marks `<html>` with its scheme. Dynamic mode leaves canvas pixels
 * alone, so a canvas drawn in the light palette stays light on a darkened page.
 * Its light ("dimmed") scheme and its Filter and Static modes set no dark
 * scheme, and Filter inverts canvases itself.
 */
export function darkReaderIsDark() {
  return (
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute(DARK_READER_ATTRIBUTE) === 'dark'
  )
}

/** Call `listener` whenever Dark Reader's scheme mark changes, and return the unsubscribe. */
export function onDarkReaderChange(listener: () => void) {
  if (
    typeof MutationObserver !== 'function' ||
    typeof document === 'undefined'
  ) {
    return () => {}
  }
  const observer = new MutationObserver(listener)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [DARK_READER_ATTRIBUTE],
  })
  return () => {
    observer.disconnect()
  }
}
