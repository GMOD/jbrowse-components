import { isCanvasWithId } from './hoverLeave.ts'

function canvasWithId(id: string) {
  const canvas = document.createElement('canvas')
  canvas.id = id
  return canvas
}

describe('isCanvasWithId', () => {
  it('recognises the display canvas, so the hover is handed to its handler', () => {
    expect(isCanvasWithId(canvasWithId('mine'), 'mine')).toBe(true)
  })

  it('does not recognise another track canvas', () => {
    expect(isCanvasWithId(canvasWithId('theirs'), 'mine')).toBe(false)
  })

  it('does not recognise non-canvas targets or no target', () => {
    const sameId = document.createElement('div')
    sameId.id = 'mine'
    expect(isCanvasWithId(sameId, 'mine')).toBe(false)
    expect(isCanvasWithId(document.body, 'mine')).toBe(false)
    expect(isCanvasWithId(null, 'mine')).toBe(false)
  })
})
