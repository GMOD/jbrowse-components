import { createDisplayTestEnvironment } from '@jbrowse/display-test-utils'
import LinearGenomeViewPlugin, {
  linearGenomeViewStateModelFactory,
} from '@jbrowse/plugin-linear-genome-view'
import { createCanvas } from '@napi-rs/canvas'
import { waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'

import { configSchema } from './configSchema.ts'
import { modelFactory } from './model.ts'

import type { LinearReferenceSequenceDisplayModel } from './model.ts'

const nodeCanvas = createCanvas as unknown as (
  width: number,
  height: number,
) => HTMLCanvasElement

// Zoomed past base resolution the display fetches nothing and the screen shows
// a placeholder in its place; the export says the same rather than leaving a
// labelled empty band.
test('a zoomed-out export carries the placeholder the screen shows', async () => {
  const { display, view } =
    createDisplayTestEnvironment<LinearReferenceSequenceDisplayModel>({
      plugins: [new LinearGenomeViewPlugin()],
      trackType: 'ReferenceSequenceTrack',
      adapter: { name: 'TestSequenceAdapter' },
      displayName: 'LinearReferenceSequenceDisplay',
      configSchema: () => configSchema,
      stateModel: (_pm, schema) => modelFactory(schema),
      viewModel: linearGenomeViewStateModelFactory,
      viewRegionEnd: 10_000_000,
    }).createDisplay()
  view.zoomTo(100)

  expect(display.placeholderMessage).toBe('Zoom in to see sequence')
  const svg = renderToString(<svg>{await display.renderSvg({})}</svg>)
  expect(svg).toContain('>Zoom in to see sequence<')
})

test('a rasterized export keeps the sequence letters text over the cells', async () => {
  const seq = 'ACGT'.repeat(25)
  const feature = new Map<string, unknown>([
    ['seq', seq],
    ['start', 0],
  ])
  const { display, view } =
    createDisplayTestEnvironment<LinearReferenceSequenceDisplayModel>({
      plugins: [new LinearGenomeViewPlugin()],
      trackType: 'ReferenceSequenceTrack',
      adapter: { name: 'TestSequenceAdapter' },
      displayName: 'LinearReferenceSequenceDisplay',
      configSchema: () => configSchema,
      stateModel: (_pm, schema) => modelFactory(schema),
      viewModel: linearGenomeViewStateModelFactory,
      viewRegionEnd: seq.length,
      rpcCall: (_sessionId, method) =>
        method === 'CoreGetFeatures'
          ? [{ get: (key: string) => feature.get(key) }]
          : undefined,
    }).createDisplay()
  view.zoomTo(0.05)
  await waitFor(() => {
    expect(display.sequenceData.get(0)?.seq).toBe(seq)
  })

  const svg = renderToString(
    <svg>
      {await display.renderSvg({
        rasterizeLayers: true,
        createCanvas: nodeCanvas,
      })}
    </svg>,
  )
  const letters = [...svg.matchAll(/<text[^>]*>([ACGT])<\/text>/g)]
  expect(svg).toContain('<image')
  expect(letters.length).toBeGreaterThan(0)
  expect(svg.indexOf('<image')).toBeLessThan(svg.indexOf('<text'))
})
