import { WebGL2Hal } from './webgl2Hal.ts'

import type { SampleCount } from './types.ts'

// The WebGL2 rung's samples are the drawing buffer's, which the browser
// multisamples when the context asks for `antialias`. A display whose passes all
// measure their own coverage is at one sample on WebGPU, and on WebGL2 it must
// not pay for the browser's four either.
function contextAttributes(sampleCount?: SampleCount) {
  let asked: WebGLContextAttributes | undefined
  const gl = new Proxy(
    {},
    {
      get: (_t, name: string) =>
        name === 'getParameter' ? () => 8192 : () => ({}),
    },
  )
  const canvas = {
    width: 100,
    height: 40,
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    getContext: (kind: string, attributes: WebGLContextAttributes) => {
      asked = attributes
      return kind === 'webgl2' ? gl : null
    },
  } as unknown as HTMLCanvasElement
  return WebGL2Hal.create(canvas, [], sampleCount).then(() => asked)
}

test('a display at one sample asks for no multisampled drawing buffer', async () => {
  expect(await contextAttributes(1)).toMatchObject({ antialias: false })
})

test('a display at four samples asks the browser for them', async () => {
  expect(await contextAttributes(4)).toMatchObject({ antialias: true })
  expect(await contextAttributes()).toMatchObject({ antialias: true })
})
