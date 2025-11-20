interface DisplayWithError {
  error?: unknown
}

export function hasError(display: DisplayWithError) {
  return !!display.error
}

export function hasAnyError(...displays: DisplayWithError[]) {
  return displays.some(d => !!d.error)
}

export function whenReadyOrError(
  readyCondition: () => boolean,
  display: DisplayWithError,
) {
  return () => readyCondition() || hasError(display)
}

export function whenReadyOrAnyError(
  readyCondition: () => boolean,
  ...displays: DisplayWithError[]
) {
  return () => readyCondition() || hasAnyError(...displays)
}
