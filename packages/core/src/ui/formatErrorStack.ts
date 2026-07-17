import { stripStackTraceMessage } from './stripStackTraceMessage.ts'

// An error's own .stack never includes its cause's stack, so the chain has to be
// walked by hand — and the cause is usually where the real failure is, since the
// wrappers (`new Error(msg, { cause: e })` in configurationSchema, mstUtils,
// tracks, ...) only stack up frames from the machinery that caught it. Causes
// survive the worker boundary intact (see rpc/serializeError), so this is the
// last place the chain would otherwise be dropped.

// guards against a pathologically long chain; cycles are caught by `seen`
const MAX_CAUSE_DEPTH = 10

function getStack(error: unknown) {
  return typeof error === 'object' && error !== null && 'stack' in error
    ? `${error.stack}`
    : ''
}

function getCause(error: unknown) {
  return typeof error === 'object' && error !== null && 'cause' in error
    ? error.cause
    : undefined
}

export function formatErrorStack(error: unknown) {
  const parts: string[] = []
  const seen = new Set<unknown>()
  let current = error
  while (
    current !== undefined &&
    current !== null &&
    !seen.has(current) &&
    parts.length < MAX_CAUSE_DEPTH
  ) {
    seen.add(current)
    // chrome prepends the message to every stack in the chain; drop it and
    // reintroduce it as the "Caused by" label so both browsers read the same
    const stack = stripStackTraceMessage(
      getStack(current),
      `${current}`,
    ).replace(/^\n/, '')
    // the caller prints the top-level message itself, so only causes get a label
    const label = parts.length === 0 ? '' : `Caused by: ${current}`
    parts.push([label, stack].filter(Boolean).join('\n'))
    current = getCause(current)
  }
  return parts.filter(Boolean).join('\n')
}
