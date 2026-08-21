import { adminServerErrorMessage } from './adminServerError.ts'

// The body that actually arrives when no admin server is listening: `npx serve`
// answers /updateConfig with a styled 404 document. Shortened here, but the
// shape — doctype, then a stylesheet — is what a probe against a real build put
// in the snackbar, roughly 1.4kB of CSS with `404` somewhere inside it.
const STATIC_404 = `<!DOCTYPE html><head> <meta name="viewport" content="width=device-width"/> <style> body { margin: 0; font-family: -apple-system, sans-serif; } section span { font-size: 24px; } </style></head><body> <main> <section> <span>404</span> <p>The requested path could not be found</p> </section> </main></body>`

test('a markup body is dropped for the status alone', () => {
  expect(adminServerErrorMessage(404, 'Not Found', STATIC_404)).toBe(
    'HTTP 404 Not Found',
  )
})

// The counterweight: a server that means to explain itself is still quoted, or
// this trades a wall of CSS for saying nothing.
test('an explanation from the admin server is kept', () => {
  expect(
    adminServerErrorMessage(403, 'Forbidden', '{"error":"bad admin key"}'),
  ).toBe('HTTP 403 Forbidden — {"error":"bad admin key"}')
})

test('a long body is cut rather than carried whole', () => {
  const message = adminServerErrorMessage(500, '', 'x'.repeat(5000))
  expect(message.length).toBeLessThan(250)
  expect(message.startsWith('HTTP 500 — xxx')).toBe(true)
  expect(message.endsWith('…')).toBe(true)
})

// HTTP/2 sends no reason phrase, so the separator must not strand a dangling
// space where the text would be.
test('an absent status text leaves no gap', () => {
  expect(adminServerErrorMessage(502, '', '')).toBe('HTTP 502')
})

// A stack trace sets the toast's height from its own line count otherwise.
test('a multi-line body is collapsed to one line', () => {
  expect(
    adminServerErrorMessage(
      500,
      'Internal Server Error',
      'at a\n  at b\n at c',
    ),
  ).toBe('HTTP 500 Internal Server Error — at a at b at c')
})
