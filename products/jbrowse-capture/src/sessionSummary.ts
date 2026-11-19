/**
 * `jb.sessionSummary()`, or undefined on a page that publishes no `window.jb`.
 * Serialized into the page.
 */
export function sessionSummaryInPage() {
  const jb: unknown = Reflect.get(window, 'jb')
  const summary: unknown =
    typeof jb === 'object' &&
    jb !== null &&
    'sessionSummary' in jb &&
    typeof jb.sessionSummary === 'function'
      ? jb.sessionSummary()
      : undefined
  return summary
}
