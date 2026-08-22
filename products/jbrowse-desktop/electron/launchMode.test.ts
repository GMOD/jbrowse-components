/**
 * @jest-environment node
 *
 * Only one JBrowse Desktop may run against a `userData` directory, because
 * everything in it is rewritten whole by a process that assumes it is alone.
 * These are the ways that could go wrong: a second instance that runs anyway,
 * or an informational flag that announces itself to the one already running.
 */
import { HELP_TEXT, resolveLaunchMode } from './launchMode.ts'

const VERSION = '3.0.0'

function acquire(available: boolean) {
  const fn = jest.fn(() => available)
  return fn
}

test('the first instance runs', () => {
  const lock = acquire(true)
  expect(resolveLaunchMode(['jbrowse-desktop'], VERSION, lock)).toEqual({
    type: 'run',
  })
  expect(lock).toHaveBeenCalledTimes(1)
})

test('a second instance does not run', () => {
  // it hands its argv over through the app's second-instance listener and
  // quits; running would put two writers on recent_sessions.json
  expect(
    resolveLaunchMode(
      ['jbrowse-desktop', '/data/my.jbrowse'],
      VERSION,
      acquire(false),
    ),
  ).toEqual({ type: 'duplicate' })
})

test.each([
  ['--version', VERSION] as const,
  ['--help', HELP_TEXT] as const,
  ['-h', HELP_TEXT] as const,
])('%s prints and never touches the lock', (flag, output) => {
  // acquiring the lock is how a launch tells the running instance to raise its
  // window and open what argv named, so an info flag must not reach it
  const lock = acquire(true)
  expect(resolveLaunchMode(['jbrowse-desktop', flag], VERSION, lock)).toEqual({
    type: 'info',
    output,
  })
  expect(lock).not.toHaveBeenCalled()
})

test('an info flag prints even while another instance holds the lock', () => {
  expect(
    resolveLaunchMode(
      ['jbrowse-desktop', '--version'],
      VERSION,
      acquire(false),
    ),
  ).toEqual({ type: 'info', output: VERSION })
})

test('argv[0] is the executable, not a flag', () => {
  // a launch from a path that happens to contain the flag text is still a launch
  const lock = acquire(true)
  expect(resolveLaunchMode(['--version'], VERSION, lock)).toEqual({
    type: 'run',
  })
  expect(lock).toHaveBeenCalledTimes(1)
})
