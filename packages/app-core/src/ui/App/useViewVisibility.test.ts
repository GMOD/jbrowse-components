import { createElement } from 'react'

import { act, render, renderHook } from '@testing-library/react'

import { useViewVisibility } from './useViewVisibility.ts'

type IoCallback = (entries: { isIntersecting: boolean }[]) => void

describe('useViewVisibility', () => {
  const realIO = globalThis.IntersectionObserver

  afterEach(() => {
    globalThis.IntersectionObserver = realIO
  })

  it('falls back to always-visible when IntersectionObserver is unavailable', () => {
    // jsdom has no IntersectionObserver; the hook must mount the view anyway so
    // the test suite and SSR keep the pre-lazy-mount behavior.
    // @ts-expect-error deliberately removing the global for this case
    delete globalThis.IntersectionObserver
    const { result } = renderHook(() => useViewVisibility('150% 0px', 400))
    expect(result.current.visible).toBe(true)
  })

  it('starts hidden then tracks the observer once the ref is mounted', () => {
    let cb: IoCallback | undefined
    class FakeIO {
      constructor(callback: IoCallback) {
        cb = callback
      }
      observe() {}
      disconnect() {}
    }
    // @ts-expect-error minimal stand-in for the observer
    globalThis.IntersectionObserver = FakeIO

    const seen: { visible: boolean; placeholderHeight: number }[] = []
    function Probe() {
      const { ref, visible, placeholderHeight } = useViewVisibility(
        '150% 0px',
        400,
      )
      seen.push({ visible, placeholderHeight })
      return createElement('div', { ref })
    }
    render(createElement(Probe))

    // mounted but observer hasn't fired: hidden, with the estimated height
    expect(seen.at(-1)).toEqual({ visible: false, placeholderHeight: 400 })

    act(() => {
      cb?.([{ isIntersecting: true }])
    })
    expect(seen.at(-1)?.visible).toBe(true)

    act(() => {
      cb?.([{ isIntersecting: false }])
    })
    expect(seen.at(-1)?.visible).toBe(false)
  })
})
