import { assemblyErrorMessage, computeViewStatus } from './viewStatus.ts'

const loadingAt = (message: string, progress?: number) => () => ({
  message,
  progress,
})
const notLoading = () => undefined

test('an error outranks every other outcome', () => {
  expect(
    computeViewStatus({
      error: 'assembly volvox not found',
      hasSomethingToShow: false,
      loading: loadingAt('Downloading chromosome aliases'),
    }),
  ).toEqual({ type: 'error', error: 'assembly volvox not found' })
})

test('nothing to show is its own state, not ready', () => {
  expect(
    computeViewStatus({
      error: undefined,
      hasSomethingToShow: false,
      loading: notLoading,
    }),
  ).toEqual({ type: 'noRegions' })
})

test('the loading payload travels with the branch', () => {
  expect(
    computeViewStatus({
      error: undefined,
      hasSomethingToShow: true,
      loading: loadingAt('Downloading chromosome aliases', 0.4),
    }),
  ).toEqual({
    type: 'loading',
    message: 'Downloading chromosome aliases',
    progress: 0.4,
  })
})

test('an indeterminate load still reports its message', () => {
  expect(
    computeViewStatus({
      error: undefined,
      hasSomethingToShow: true,
      loading: loadingAt('Loading'),
    }),
  ).toEqual({ type: 'loading', message: 'Loading', progress: undefined })
})

test('ready is the only outcome with no payload to read', () => {
  expect(
    computeViewStatus({
      error: undefined,
      hasSomethingToShow: true,
      loading: notLoading,
    }),
  ).toEqual({ type: 'ready' })
})

// The reason the input is a thunk rather than a value. `loadingMessage` and
// `loadingProgress` read the assembly's download status, which ticks while a
// file is in flight; a ready view that evaluated them would subscribe to that
// churn and re-render on every tick for a string it never draws.
test('the loading term is not evaluated once a terminal state is decided', () => {
  const loading = jest.fn(() => ({ message: 'Loading', progress: undefined }))
  computeViewStatus({ error: 'boom', hasSomethingToShow: true, loading })
  computeViewStatus({
    error: undefined,
    hasSomethingToShow: false,
    loading,
  })
  expect(loading).not.toHaveBeenCalled()
})

const managerWith = (errors: Record<string, unknown>) => ({
  get: (name: string) => ({ error: errors[name] }),
})

// The regression this exists to hold. `''` is falsy, so every in-app reader
// (`if (this.error)`, `find(v => v.error)`) agreed with `undefined` and nothing
// showed — while `DotplotView.error` folded it in with `??` and jbrowse-img
// tests `!== undefined`, so every dotplot render failed with an empty message.
test('no assembly failed is undefined, never the empty string', () => {
  expect(assemblyErrorMessage(managerWith({}), ['volvox', 'volvox2'])).toBe(
    undefined,
  )
  expect(assemblyErrorMessage(managerWith({}), [])).toBe(undefined)
})

test('the failures that happened are joined', () => {
  expect(
    assemblyErrorMessage(managerWith({ volvox2: 'fai missing' }), [
      'volvox',
      'volvox2',
    ]),
  ).toBe('fai missing')
  expect(
    assemblyErrorMessage(
      managerWith({ volvox: 'no such file', volvox2: 'fai missing' }),
      ['volvox', 'volvox2'],
    ),
  ).toBe('no such file, fai missing')
})

test('an assembly the manager cannot resolve is not a failure of its own', () => {
  expect(assemblyErrorMessage({ get: () => undefined }, ['volvox'])).toBe(
    undefined,
  )
})
