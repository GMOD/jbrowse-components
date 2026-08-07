import { createElement } from 'react'

import { act, render, renderHook } from '@testing-library/react'

import { useViewVisibility } from './useViewVisibility.ts'

// the two fields the hook reads off a real IntersectionObserverEntry
interface FakeEntry {
  isIntersecting: boolean
  boundingClientRect: { height: number }
}
type IoCallback = (entries: FakeEntry[]) => void

function entry(isIntersecting: boolean, height = 0): FakeEntry {
  return { isIntersecting, boundingClientRect: { height } }
}

let cb: IoCallback | undefined

function installFakeObserver() {
  cb = undefined
  class FakeIO {
    constructor(callback: IoCallback) {
      cb = callback
    }
    observe() {}
    disconnect() {}
  }
  // @ts-expect-error minimal stand-in for the observer
  globalThis.IntersectionObserver = FakeIO
}

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
    const { result } = renderHook(() => useViewVisibility('150% 0px'))
    expect(result.current.visible).toBe(true)
  })

  it('starts hidden then tracks the observer once the ref is mounted', () => {
    installFakeObserver()

    const seen: { visible: boolean; measuredHeight?: number }[] = []
    function Probe() {
      const { ref, visible, measuredHeight } = useViewVisibility('150% 0px')
      seen.push({ visible, measuredHeight })
      return createElement('div', { ref })
    }
    render(createElement(Probe))

    // mounted but the observer hasn't fired: hidden, and nothing measured yet,
    // which is what makes ViewContainer fall back to its own estimate
    expect(seen.at(-1)).toEqual({ visible: false, measuredHeight: undefined })

    act(() => {
      cb?.([entry(true)])
    })
    expect(seen.at(-1)?.visible).toBe(true)

    act(() => {
      cb?.([entry(false, 720)])
    })
    // the height the body had on the way out becomes the spacer's, so the
    // scroll position it used to occupy survives the unmount
    expect(seen.at(-1)).toEqual({ visible: false, measuredHeight: 720 })
  })

  it('reports nothing measured when the body has zero height on the way out', () => {
    installFakeObserver()

    const { result } = renderHook(() => useViewVisibility('150% 0px'))
    act(() => {
      cb?.([entry(true)])
    })
    // a minimized view renders no body at all, so it measures 0, which must not
    // become its remembered height
    act(() => {
      cb?.([entry(false, 0)])
    })
    expect(result.current.measuredHeight).toBeUndefined()
  })

  it('does not re-render when the observer reports the same visibility twice', () => {
    installFakeObserver()

    let renders = 0
    function Probe() {
      renders++
      const { ref } = useViewVisibility('150% 0px')
      return createElement('div', { ref })
    }
    render(createElement(Probe))
    const afterMount = renders

    act(() => {
      cb?.([entry(false)])
    })
    expect(renders).toBe(afterMount)
  })
})
