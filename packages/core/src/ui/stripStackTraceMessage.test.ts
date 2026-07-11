import { stripStackTraceMessage } from './stripStackTraceMessage.ts'

// Chrome prepends "<Name>: <message>" to the stack; Firefox does not
test('strips the Chrome message prefix for an Error subclass', () => {
  const message = 'TypeError: x is not a function'
  const trace = `${message}\n    at foo (file.js:1:1)`
  expect(stripStackTraceMessage(trace, message)).toBe(
    '\n    at foo (file.js:1:1)',
  )
})

test('leaves a Firefox-style trace (no message prefix) unchanged', () => {
  const message = 'TypeError: x is not a function'
  const trace = 'foo@file.js:1:1'
  expect(stripStackTraceMessage(trace, message)).toBe(trace)
})

test('is a no-op when there is no message', () => {
  const trace = 'foo@file.js:1:1'
  expect(stripStackTraceMessage(trace, '')).toBe(trace)
})
