import { render } from '@testing-library/react'

import { createTestEnvironment } from '../../LinearMultiSampleVariantDisplay/testEnv.ts'
import SvgVariantOverlay from './SvgVariantOverlay.tsx'

import type { Source } from '../types.ts'

// What the on-screen display shows must survive the SVG export. Each case here
// is a thing that used to be visible live and absent in the exported figure:
// the sidebar color swatches, a lone sample's row label, and the color key.
//
// Built inside a real view rather than as a bare `stateModel.create()`. The
// overlay renders `legendSections()`, and the insertion entry asks the painter's
// own question about the visible blocks, so the model needs the view its
// components always have in the app.
function createDisplay(sources: Source[]) {
  const { display } = createTestEnvironment().createDisplay()
  display.setSources(sources)
  return display
}

function renderOverlay(model: ReturnType<typeof createDisplay>) {
  return render(
    <svg>
      <SvgVariantOverlay
        model={model}
        idPrefix="variant-clip"
        width={800}
        height={model.height}
      >
        <g />
      </SvgVariantOverlay>
    </svg>,
  )
}

test('sidebar row color swatches export', () => {
  const model = createDisplay([
    { name: 'HG001', population: 'EUR' },
    { name: 'HG002', population: 'AFR' },
  ])
  model.setColorBy('population')
  const colors = model.sources
    .map(s => s.labelColor)
    .filter(c => c !== undefined)
  expect(new Set(colors).size).toBe(2)

  const { container } = renderOverlay(model)
  for (const color of colors) {
    // jsdom has no `CSS`, so `CSS.escape` — which is what
    // `unicorn/require-css-escape` autofixes this to — is a ReferenceError
    // here. The values are the model's own color strings, not user input.
    // eslint-disable-next-line unicorn/require-css-escape
    expect(container.querySelector(`rect[fill="${color}"]`)).toBeTruthy()
  }
})

test('a single-sample track labels its one row', () => {
  const model = createDisplay([{ name: 'HG001' }])
  const { getByText } = renderOverlay(model)
  getByText('HG001')
})

test('the genotype color key exports, untitled when it is the only section', () => {
  const model = createDisplay([{ name: 'HG001' }, { name: 'HG002' }])
  const { getByText, queryByText } = renderOverlay(model)
  getByText('Homozygous reference')
  getByText('Homozygous alt')
  expect(queryByText('Genotypes')).toBeNull()
})

test('colorBy adds a titled sample-grouping section to the exported key', () => {
  const model = createDisplay([
    { name: 'HG001', population: 'EUR' },
    { name: 'HG002', population: 'AFR' },
  ])
  model.setColorBy('population')
  const { getByText } = renderOverlay(model)
  getByText('Genotypes')
  getByText('Population')
  getByText('EUR')
  getByText('AFR')
})

test('a hidden legend exports nothing', () => {
  const model = createDisplay([{ name: 'HG001' }, { name: 'HG002' }])
  model.setShowLegend(false)
  const { queryByText } = renderOverlay(model)
  expect(queryByText('Homozygous reference')).toBeNull()
})
