export function isReadyOrHasError(display: {
  renderProps(): { notReady?: boolean }
  error?: unknown
}) {
  return !display.renderProps().notReady || !!display.error
}

export function hasAnySubDisplayError(displays: { error?: unknown }[]) {
  return displays.some(d => !!d.error)
}
