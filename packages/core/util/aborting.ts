export function isAbortException(exception: unknown): boolean {
  return (
    exception instanceof Error &&
    // DOMException
    (exception.name === 'AbortError' ||
      // standard-ish non-DOM abort exception
      // @ts-expect-error
      exception.code === 'ERR_ABORTED' ||
      // message contains aborted for bubbling through RPC
      // things we have seen that we want to catch here
      // Error: aborted
      // AbortError: aborted
      // AbortError: The user aborted a request.
      !!/\b(aborted|aborterror)\b/i.test(exception.message))
  )
}
