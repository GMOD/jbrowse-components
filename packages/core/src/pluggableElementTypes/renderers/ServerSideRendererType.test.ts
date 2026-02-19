import { isValidElement } from 'react'

import ServerSideRenderer from './ServerSideRendererType.ts'

import type { RenderArgs, ResultsSerialized } from './ServerSideRendererType.ts'

// Minimal renderer instance for testing deserializeResultsInClient
function createRenderer() {
  return new ServerSideRenderer({
    name: 'TestRenderer',
    ReactComponent: () => null,
    configSchema: { create: () => ({}) },
    pluginManager: {},
  } as Parameters<(typeof ServerSideRenderer)['prototype']['constructor']>[0])
}

test('deserializeResultsInClient returns undefined reactElement when html is already present during SVG export', () => {
  const renderer = createRenderer()
  const res = { html: '<svg>...</svg>' } as ResultsSerialized
  const args = {
    exportSVG: { rasterizeLayers: true },
    sessionId: 'test',
  } as RenderArgs

  const result = renderer.deserializeResultsInClient(res, args)

  // reactElement must not be a valid React element when html is present,
  // otherwise ReactRendering will render the element (which returns null)
  // instead of using dangerouslySetInnerHTML with the html content.
  // This bug only manifests with WebWorkerRpcDriver where the worker
  // converts canvasRecordedData to html before deserializeResultsInClient
  // is called.
  expect(isValidElement(result.reactElement)).toBe(false)
  expect(result.html).toBe('<svg>...</svg>')
})

test('deserializeResultsInClient creates a valid reactElement for SVG export without html', () => {
  const renderer = createRenderer()
  const res = { canvasRecordedData: {} } as unknown as ResultsSerialized
  const args = {
    exportSVG: {},
    sessionId: 'test',
  } as RenderArgs

  const result = renderer.deserializeResultsInClient(res, args)

  expect(isValidElement(result.reactElement)).toBe(true)
})

test('deserializeResultsInClient creates a valid reactElement for normal rendering', () => {
  const renderer = createRenderer()
  const res = { imageData: {} } as unknown as ResultsSerialized
  const args = { sessionId: 'test' } as RenderArgs

  const result = renderer.deserializeResultsInClient(res, args)

  expect(isValidElement(result.reactElement)).toBe(true)
})
