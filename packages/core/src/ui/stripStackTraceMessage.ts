// Chrome prepends the error message to the stack trace; Firefox doesn't. Strip
// it to avoid duplication (the message is already shown above the trace). The
// message is the stringified error, e.g. "TypeError: foo" for any Error
// subclass, so compare against it rather than a hardcoded "Error:" prefix.
export function stripStackTraceMessage(trace: string, message: string) {
  return message && trace.startsWith(message)
    ? trace.slice(message.length)
    : trace
}
