import { onReactionError } from 'mobx'

/**
 * Errors the page raised that nothing else in the envelope carries.
 *
 * `notifications` holds only what someone chose to raise, and `notReady` only
 * what a display recorded on itself. An uncaught throw, a rejected promise
 * nobody awaited, and a mobx reaction that threw all reach devtools and stop
 * there — which is the class that settles clean and screenshots as a browser
 * with one track quietly missing.
 *
 * Reactions are why mobx is imported here rather than the DOM alone: mobx
 * reports a reaction's throw to `onReactionError` and to no caller, so a view
 * that dies inside one leaves no trace an agent can reach.
 */
const MAX_ENTRIES = 20
const MAX_CHARS = 500

export interface PageError {
  source: 'uncaught' | 'unhandledRejection' | 'reaction' | 'dropped'
  message: string
}

const buffered: PageError[] = []
let dropped = 0

function record(source: PageError['source'], value: unknown) {
  if (buffered.length >= MAX_ENTRIES) {
    dropped += 1
    return
  }
  const text =
    value instanceof Error ? `${value.name}: ${value.message}` : String(value)
  buffered.push({
    source,
    message: text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}…` : text,
  })
}

let watching = false

export function watchPageErrors() {
  if (watching || typeof window === 'undefined') {
    return
  }
  watching = true
  window.addEventListener('error', event => {
    record('uncaught', event.error ?? event.message)
  })
  window.addEventListener('unhandledrejection', event => {
    record('unhandledRejection', event.reason)
  })
  onReactionError(e => {
    record('reaction', e)
  })
}

// Delivered once each, like a notification: what the envelope promises is what
// has happened since the previous call.
export function drainPageErrors() {
  const errors = buffered.splice(0)
  if (dropped > 0) {
    errors.push({
      source: 'dropped',
      message: `${dropped} further page error(s) dropped`,
    })
    dropped = 0
  }
  return errors
}
