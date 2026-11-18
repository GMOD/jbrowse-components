import { createAutosaveReporter } from './autosaveReporter.ts'

function recordingSession() {
  const toasts: string[] = []
  return {
    toasts,
    notify(message: string) {
      toasts.push(message)
    },
    notifyError(message: string) {
      toasts.push(`error: ${message}`)
    },
  }
}

test('a failure that persists is reported once, and its end once', () => {
  const session = recordingSession()
  const reporter = createAutosaveReporter()

  reporter.saved(session)
  reporter.failed(session, new Error('quota'))
  reporter.failed(session, new Error('quota'))
  reporter.saved(session)
  reporter.saved(session)

  expect(session.toasts).toEqual([
    'error: Error: quota',
    'Auto-saving restored',
  ])
})

test('a failure can carry its own message', () => {
  const session = recordingSession()
  createAutosaveReporter().failed(session, new Error('x'), 'Disk is full')
  expect(session.toasts).toEqual(['error: Disk is full'])
})

test('the latch belongs to the autosave, not to the session it reports on', () => {
  const before = recordingSession()
  const after = recordingSession()
  const reporter = createAutosaveReporter()

  reporter.failed(before, new Error('gone'))
  reporter.failed(after, new Error('gone'))
  reporter.saved(after)

  expect(before.toasts).toEqual(['error: Error: gone'])
  expect(after.toasts).toEqual(['Auto-saving restored'])
})

test('each autosave keeps its own latch', () => {
  const session = recordingSession()
  createAutosaveReporter().failed(session, new Error('a'))
  createAutosaveReporter().failed(session, new Error('b'))
  expect(session.toasts).toEqual(['error: Error: a', 'error: Error: b'])
})
