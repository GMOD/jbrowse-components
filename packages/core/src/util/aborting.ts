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
 * The one way a fetch's catch block answers a thrown error, shared by every
 * fetch family (FetchMixin's runFetch, the comparative installer, chord): an
 * abort is the ordinary end of a superseded or cancelled fetch and is
 * swallowed, and so is any failure of a fetch that is no longer the current
 * one — a superseded fetch's error is routinely its teardown's side effect,
 * and it must not overwrite the error slot (or the console) its successor
 * owns. Only a current fetch's real failure is logged and published. The
 * three sites used to spell this independently and had drifted on whether the
 * log was currency-guarded; the comparative family's pin ("does not let a
 * superseded fetch raise its error") is the semantic that was deliberate.
 */
export function handleFetchError(
  exception: unknown,
  isCurrent: () => boolean,
  setError: (e: unknown) => void,
) {
  if (!isAbortException(exception) && isCurrent()) {
    console.error(exception)
    setError(exception)
  }
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
