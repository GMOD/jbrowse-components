import { OomReporter } from './oomReporter.ts'

test('logs and forwards to the handler once wired', () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
  const seen: Error[] = []
  const reporter = new OomReporter('TestHal')

  // Before a handler is wired, report still logs but drops silently.
  reporter.report('buffer too big')
  expect(seen).toHaveLength(0)
  expect(spy).toHaveBeenCalledWith('[TestHal] buffer too big')

  reporter.setHandler(e => seen.push(e))
  reporter.report('texture too big')
  expect(seen).toHaveLength(1)
  expect(seen[0]!.message).toBe('texture too big')

  spy.mockRestore()
})
