import { act, render } from '@testing-library/react'
import { observable, runInAction } from 'mobx'

import { RingStrips } from './RingLayer.tsx'

import type { RingHostModel } from './ringHost.ts'

// A strip unregistered and registered again leaves its ring without a cell
// for a moment, and the ring's texture is released and uploaded anew.
test('a zoom re-renders the strips without registering them again', () => {
  const registrations: string[] = []
  const display = { id: 'd1', height: 20, RenderingComponent: () => null }
  const state = observable({ width: 100 })
  const host = {
    get width() {
      return state.width
    },
    rings: [{ display, innerPx: 10, outerPx: 30 }],
    setStripElement: (id: string, el: HTMLElement | null) => {
      registrations.push(`${id}:${el ? 'el' : 'null'}`)
    },
  } as unknown as RingHostModel
  const { getByTestId } = render(<RingStrips host={host} />)
  act(() => {
    runInAction(() => {
      state.width = 200
    })
  })
  const strip = getByTestId('circular-ring-strips').firstElementChild
  expect((strip as HTMLElement).style.width).toBe('200px')
  expect(registrations).toEqual(['d1:el'])
})
