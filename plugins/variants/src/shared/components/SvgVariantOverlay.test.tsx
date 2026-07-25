import { render } from '@testing-library/react'

import configFactory from '../../LinearMultiSampleVariantDisplay/configSchema.ts'
import stateModelFactory from '../../LinearMultiSampleVariantDisplay/model.ts'
import SvgVariantOverlay from './SvgVariantOverlay.tsx'

import type { Source } from '../types.ts'

// What the on-screen display shows must survive the SVG export. Each case here
// is a thing that used to be visible live and absent in the exported figure:
// the sidebar color swatches, a lone sample's row label, and the color key.
function createDisplay(sources: Source[]) {
  const configSchema = configFactory()
  const model = stateModelFactory(configSchema).create({
    type: 'LinearMultiSampleVariantDisplay',
    configuration: configSchema.create({
      type: 'LinearMultiSampleVariantDisplay',
      displayId: 'svg-overlay-test',
    }),
  })
  model.setSources(sources)
  return model
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
  const colors = model.sources!.map(s => s.color)
  expect(new Set(colors).size).toBe(2)

  const { container } = renderOverlay(model)
  for (const color of colors) {
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
