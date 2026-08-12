import {
  isGpuRenderingDisabled,
  setGpuOverride,
} from '@jbrowse/render-core/gpuDevice'
import { createGpuContextLostError } from '@jbrowse/render-core/useRenderingBackend'
import { cleanup, fireEvent, render } from '@testing-library/react'

import ErrorBanner from './ErrorBanner.tsx'
import GpuFallbackButton from './GpuFallbackButton.tsx'
import { shouldOfferGpuFallback } from './gpuFallback.ts'

afterEach(() => {
  cleanup()
  setGpuOverride(null)
})

test('a lost context offers the switch', () => {
  expect(shouldOfferGpuFallback(createGpuContextLostError())).toBe(true)
})

test('an unrelated error does not — its remedy is not a backend change', () => {
  expect(shouldOfferGpuFallback(new Error('region too large'))).toBe(false)
})

test('nothing is offered once the GPU is already off', () => {
  setGpuOverride('canvas2d')
  expect(shouldOfferGpuFallback(createGpuContextLostError())).toBe(false)
})

// The trap this whole helper exists to make hard to fall into. Synteny's level
// banner shows one message built from the GPU error *and* every display's fetch
// error, and it builds it with `errors.join('\n')` — so the value the banner
// renders is a string, and the lost-context marker lives on the error object.
// Hand that string to the predicate and the button silently never appears, which
// is indistinguishable from "this build has no escape hatch". The call site
// passes `gpuError`; this is what says why.
test('a stringified error offers nothing, however lost the context was', () => {
  const real = createGpuContextLostError()
  expect(shouldOfferGpuFallback(real)).toBe(true)
  expect(shouldOfferGpuFallback([real, 'fetch failed'].join('\n'))).toBe(false)
  expect(shouldOfferGpuFallback(`${real}`)).toBe(false)
})

test('the button renders nothing when it would not help', () => {
  const { queryByTestId } = render(
    <GpuFallbackButton error={new Error('nope')} onRetry={() => {}} />,
  )
  expect(queryByTestId('use_canvas2d_button')).toBeNull()
})

test('clicking it turns the GPU off page-wide and retries', () => {
  const onRetry = jest.fn()
  const { getByTestId } = render(
    <GpuFallbackButton error={createGpuContextLostError()} onRetry={onRetry} />,
  )

  expect(isGpuRenderingDisabled()).toBe(false)
  fireEvent.click(getByTestId('use_canvas2d_button'))

  expect(isGpuRenderingDisabled()).toBe(true)
  expect(onRetry).toHaveBeenCalledTimes(1)
})

// ErrorBanner is the presentation dotplot and synteny use — ErrorOverlay/ErrorBar
// already carried `extraAction` and those two did not, which is why neither view
// could offer the escape at all.
test('ErrorBanner renders an extraAction beside its own buttons', () => {
  const error = createGpuContextLostError()
  const { getByTestId } = render(
    <ErrorBanner
      error={error}
      onReset={() => {}}
      extraAction={<GpuFallbackButton error={error} onRetry={() => {}} />}
    />,
  )
  // getByTestId throws when absent, so this is the assertion; the text check is
  // what says the slot renders the action rather than an empty wrapper
  expect(getByTestId('use_canvas2d_button').textContent).toBe('Use Canvas2D')
})
