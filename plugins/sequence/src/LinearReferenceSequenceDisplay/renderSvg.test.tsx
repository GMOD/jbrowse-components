import { createDisplayTestEnvironment } from '@jbrowse/display-test-utils'
import LinearGenomeViewPlugin, {
  linearGenomeViewStateModelFactory,
} from '@jbrowse/plugin-linear-genome-view'
import { renderToString } from 'react-dom/server'

import { configSchema } from './configSchema.ts'
import { modelFactory } from './model.ts'

import type { LinearReferenceSequenceDisplayModel } from './model.ts'

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
