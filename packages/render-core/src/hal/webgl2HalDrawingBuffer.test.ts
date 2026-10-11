import { WebGL2Hal } from './webgl2Hal.ts'

// Chrome caps a WebGL drawing buffer at 7680x4320 px of area and shrinks it,
// aspect kept, while `canvas.width/height` keep the requested size. Three ANGLE
// backends shrank 5120x6600 to 5073x6539.
const BROWSER_DRAWING_BUFFER_AREA = 7680 * 4320

function shrunk(w: number, h: number) {
  const k = Math.min(1, Math.sqrt(BROWSER_DRAWING_BUFFER_AREA / (w * h)))
  return [Math.floor(w * k), Math.floor(h * k)] as const
}

async function halOverShrinkingCanvas({ lost = false } = {}) {
  const calls: [string, number[]][] = []
  const canvas = {
    width: 300,
    height: 150,
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    getContext: () => gl,
  } as unknown as HTMLCanvasElement
  const gl = new Proxy(
    {},
    {
      get: (_t, name: string) => {
        if (name === 'drawingBufferWidth') {
          return lost ? 0 : shrunk(canvas.width, canvas.height)[0]
        }
        if (name === 'drawingBufferHeight') {
          return lost ? 0 : shrunk(canvas.width, canvas.height)[1]
        }
        if (name === 'getParameter') {
          return () => 16384
        }
        return (...args: number[]) => {
          calls.push([name, args])
          return {}
        }
      },
    },
  )
  const hal = await WebGL2Hal.create(canvas, [])
  return { hal, calls }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'devicePixelRatio', {
    value: 2,
    configurable: true,
  })
})

test('a shrunk drawing buffer reports the scale it got, and flips on its height', async () => {
  const { hal, calls } = await halOverShrinkingCanvas()
  const scale = hal.resize(2560, 3300)
  const [bufferW, bufferH] = shrunk(5120, 6600)
  expect([bufferW, bufferH]).toEqual([5073, 6539])
  expect(scale.x).toBeCloseTo(bufferW / 2560, 6)
  expect(scale.y).toBeCloseTo(bufferH / 3300, 6)

  calls.length = 0
  hal.beginFrame(0, 0, 0, 0)
  hal.setScissor(0, 0, 100, 600)
  hal.setViewport(0, 0, 100, 600)
  expect(calls.filter(([n]) => n === 'viewport' || n === 'scissor')).toEqual([
    ['viewport', [0, 0, bufferW, bufferH]],
    ['scissor', [0, bufferH - 600, 100, 600]],
    ['viewport', [0, bufferH - 600, 100, 600]],
  ])
})

test('an unshrunk canvas still reports getDpr on both axes', async () => {
  const { hal } = await halOverShrinkingCanvas()
  expect(hal.resize(1600, 1200)).toEqual({ x: 2, y: 2 })
})

test('a lost context, whose drawing buffer reads 0x0, reports the canvas scale', async () => {
  const { hal } = await halOverShrinkingCanvas({ lost: true })
  expect(hal.resize(2560, 2000)).toEqual({ x: 2, y: 2 })
})
