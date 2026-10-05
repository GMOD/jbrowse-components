import { types } from '@jbrowse/mobx-state-tree'
import { act, fireEvent, render } from '@testing-library/react'

import { useLaneSlide } from './useLaneSlide.ts'

import type { LaneSlideModel } from './useLaneSlide.ts'

afterEach(() => {
  jest.restoreAllMocks()
})

const SlideModel = types
  .model({})
  .volatile(() => ({
    laneDragPx: new Map<string, number>() as ReadonlyMap<string, number>,
    ended: [] as string[],
  }))
  .views(() => ({
    slidableLaneAt(_y: number): string | undefined {
      return 'peach'
    },
  }))
  .actions(self => ({
    setLaneDragPx(assemblyName: string, dxPx: number) {
      self.laneDragPx = new Map([[assemblyName, dxPx]])
    },
    endLaneDrag(assemblyName: string) {
      self.ended.push(assemblyName)
    },
  }))

function Harness({ model }: { model: LaneSlideModel }) {
  const slide = useLaneSlide(model, null)
  return (
    <div data-testid="panel" onPointerDown={slide}>
      <canvas data-testid="canvas" />
    </div>
  )
}

function pointer(type: string, init: PointerEventInit) {
  act(() => {
    window.dispatchEvent(new PointerEvent(type, init))
  })
}

test("a second finger neither moves a lane's slide nor ends it", () => {
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
    cb(0)
    return 1
  })
  const model = SlideModel.create()
  const { getByTestId } = render(<Harness model={model} />)
  act(() => {
    fireEvent.pointerDown(getByTestId('canvas'), {
      button: 0,
      isPrimary: true,
      pointerId: 1,
      clientX: 100,
    })
  })
  pointer('pointermove', { pointerId: 2, clientX: 400 })
  pointer('pointermove', { pointerId: 1, clientX: 130 })
  expect(model.laneDragPx.get('peach')).toBe(30)
  pointer('pointerup', { pointerId: 2, clientX: 400 })
  expect(model.ended).toEqual([])
  pointer('pointerup', { pointerId: 1, clientX: 130 })
  expect(model.ended).toEqual(['peach'])
  expect(model.laneDragPx.get('peach')).toBe(30)
})

test('a press by a second finger starts no slide', () => {
  const model = SlideModel.create()
  const { getByTestId } = render(<Harness model={model} />)
  act(() => {
    fireEvent.pointerDown(getByTestId('canvas'), {
      button: 0,
      isPrimary: false,
      pointerId: 2,
      clientX: 100,
    })
  })
  pointer('pointermove', { pointerId: 2, clientX: 160 })
  pointer('pointerup', { pointerId: 2, clientX: 160 })
  expect(model.laneDragPx.size).toBe(0)
  expect(model.ended).toEqual([])
})
