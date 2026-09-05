import { createTestEnvironment } from './testEnv.ts'

const { createDisplay } = createTestEnvironment()

test('loading before the first paint', () => {
  const { display } = createDisplay()
  expect(display.canvasDrawn).toBe(false)
  expect(display.displayPhase).toBe('loading')
})

test('ready once painted with the viewport covered', () => {
  const { display, view } = createDisplay()
  display.setLoadedRegion(0, view.displayedRegions[0], undefined)
  display.markCanvasDrawn()
  expect(display.displayPhase).toBe('ready')
})

test('loading again when the viewport leaves loaded data', () => {
  const { display, view } = createDisplay()
  display.setLoadedRegion(
    0,
    {
      ...view.displayedRegions[0]!,
      end: 100,
    },
    undefined,
  )
  display.markCanvasDrawn()
  expect(display.viewportWithinLoadedData).toBe(false)
  expect(display.displayPhase).toBe('loading')
})

test('a user cancel keeps the overlay up even though isLoading is false', () => {
  const { display, view } = createDisplay()
  display.setLoadedRegion(0, view.displayedRegions[0], undefined)
  display.markCanvasDrawn()
  expect(display.displayPhase).toBe('ready')

  display.cancelFetchByUser()
  expect(display.isLoading).toBe(false)
  expect(display.fetchCanceled).toBe(true)
  expect(display.displayPhase).toBe('loading')
})

test('a display whose fetch failed before first paint reports painted', () => {
  const { display } = createDisplay()
  expect(display.rendersCanvas).toBe(true)
  expect(display.canvasDrawn).toBe(false)
  expect(display.painted).toBe(false)

  display.setError(new Error('404'))
  expect(display.painted).toBe(true)

  display.setError(undefined)
  expect(display.painted).toBe(false)
})

test('an error outranks loading', () => {
  const { display } = createDisplay()
  expect(display.displayPhase).toBe('loading')
  display.setError(new Error('boom'))
  expect(display.displayPhase).toBe('error')
})

test('renderError outranks everything', () => {
  const { display } = createDisplay()
  display.setError(new Error('boom'))
  display.setRenderError(new Error('gpu'))
  expect(display.displayPhase).toBe('renderError')
})
