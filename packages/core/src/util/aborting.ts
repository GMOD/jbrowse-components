class AbortError extends Error {
  public code: string | undefined
}

export function makeAbortError() {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('aborted', 'AbortError')
  }
  const e = new AbortError('aborted')
  e.code = 'ERR_ABORTED'
  return e
}

/**
 * check if the given exception was caused by an operation being intentionally aborted
 * @param exception -
 */
export function isAbortException(exception: unknown): boolean {
  return (
    // DOMException
    // message contains aborted for bubbling through RPC
    // things we have seen that we want to catch here
    // Error: aborted
    // AbortError: aborted
    // AbortError: The user aborted a request.
    exception instanceof Error &&
    (exception.name === 'AbortError' ||
      // standard-ish non-DOM abort exception
      (exception instanceof AbortError && exception.code === 'ERR_ABORTED') ||
      /\b(aborted|aborterror)\b/i.test(exception.message))
  )
}
