import { act, render, screen } from '@testing-library/react'
import { observable, runInAction } from 'mobx'
import { observer } from 'mobx-react'

import { PosterFirst } from './poster.tsx'

let intersect: (isIntersecting: boolean) => void

beforeEach(() => {
  window.IntersectionObserver = class {
    constructor(cb: IntersectionObserverCallback) {
      intersect = isIntersecting => {
        cb(
          [{ isIntersecting } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        )
      }
    }
    observe() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver
  jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(cb => {
    cb(0)
    return 0
  })
})

const poster = { src: '/poster.png', width: 800, height: 232 }

function setup() {
  const app = observable({ phase: 'loading' })
  const Marker = observer(function Marker() {
    return <span hidden data-app-phase={app.phase} data-app-views="1" />
  })
  const { container } = render(
    <PosterFirst poster={poster} alt="genes">
      <Marker />
    </PosterFirst>,
  )
  return { app, container }
}

test('the poster holds until the view reads ready, then the view shows', async () => {
  const { app, container } = setup()
  expect(container.querySelector('[data-app-phase]')).toBeNull()

  act(() => {
    intersect(true)
  })
  const viewBox = container.querySelector('[data-app-phase]')!.parentElement!
  expect(viewBox.style.opacity).toBe('0')
  expect(viewBox.hasAttribute('inert')).toBe(true)
  expect(screen.getByAltText('genes')).toBeTruthy()

  await act(async () => {
    runInAction(() => {
      app.phase = 'ready'
    })
    await new Promise(r => setTimeout(r, 0))
  })
  expect(screen.queryByAltText('genes')).toBeNull()
  expect(viewBox.style.opacity).toBe('1')
  expect(viewBox.hasAttribute('inert')).toBe(false)
})

test('the view mounts only once its box nears the viewport', () => {
  const { container } = setup()
  act(() => {
    intersect(false)
  })
  expect(container.querySelector('[data-app-phase]')).toBeNull()
  expect(screen.getByAltText('genes')).toBeTruthy()
})
