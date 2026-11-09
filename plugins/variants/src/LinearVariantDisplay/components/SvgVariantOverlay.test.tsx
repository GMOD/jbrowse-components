import { readFileSync } from 'node:fs'
import path from 'node:path'

import { parseSamplesTsv } from '@jbrowse/core/util/samplesTsv'
import { SvgLegend, exportedY } from '@jbrowse/display-kit/renderDisplaySvg'
import { render, within } from '@testing-library/react'

import { createTestEnvironment } from '../testEnv.ts'
import SvgVariantOverlay from './SvgVariantOverlay.tsx'

import type { Source } from '../../shared/types.ts'

// What the on-screen display shows must survive the SVG export. Each case here
// is a thing that used to be visible live and absent in the exported figure:
// the sidebar color swatches, a lone sample's row label, and the color key.
//
// Built inside a real view rather than as a bare `stateModel.create()`. The
// key derives from `colorScales`, and the insertion entry asks the painter's
// own question about the visible blocks, so the model needs the view its
// components always have in the app.
function createDisplay(sources: Source[], rows?: Record<string, unknown>) {
  const { display } = createTestEnvironment({
    displayConfig: { genotypes: { show: true }, ...(rows ? { rows } : {}) },
  }).createDisplay()
  display.setSources(sources)
  return display
}

// The key is the exporting view's, so these cases render its component over
// this model: what they check is that it keys the display off
// the same scales the screen does.
function renderKey(model: ReturnType<typeof createDisplay>) {
  return render(
    <svg>
      <SvgLegend model={model} width={800} height={model.height} />
    </svg>,
  )
}

function renderOverlay(model: ReturnType<typeof createDisplay>) {
  return render(
    <svg>
      <SvgVariantOverlay model={model} width={800} overlays>
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
  model.setRowColorChoice('population')
  const colors = model.sources.map(s => s.rowColor).filter(c => c !== undefined)
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

test('the genotype color key exports, titled by its one scale', () => {
  const model = createDisplay([{ name: 'HG001' }, { name: 'HG002' }])
  const { getByText } = renderKey(model)
  getByText('Homozygous reference')
  getByText('Alt, full dosage (hom)')
  getByText('Genotypes')
})

test('colorBy adds a titled sample-grouping section to the exported key', () => {
  const model = createDisplay([
    { name: 'HG001', population: 'EUR' },
    { name: 'HG002', population: 'AFR' },
  ])
  model.setRowColorChoice('population')
  const { getByText } = renderKey(model)
  getByText('Genotypes')
  getByText('Population')
  getByText('EUR')
  getByText('AFR')
})

test('a hidden legend exports nothing', () => {
  const model = createDisplay([{ name: 'HG001' }, { name: 'HG002' }])
  model.setShowLegend(false)
  const { queryByText } = renderKey(model)
  expect(queryByText('Homozygous reference')).toBeNull()
})

// volvox.sv.samples.tsv gives each sample a population and a sex, so the two
// columns stand side by side past no row color, and the gutter the export
// reserves widens by both.
test('rows.annotations exports a color column per attribute, each with a key', () => {
  const { sources } = parseSamplesTsv(
    readFileSync(
      path.resolve('test_data/volvox/volvox.sv.samples.tsv'),
      'utf8',
    ),
    undefined,
    'volvox.sv.samples.tsv',
    'the VCF',
  )
  const plain = createDisplay(sources, { step: 20 })
  const model = createDisplay(sources, {
    step: 20,
    annotations: ['population', 'sex'],
  })
  expect(model.svgSidebarWidth()).toBeCloseTo(plain.svgSidebarWidth() + 8)
  expect(
    renderOverlay(plain).container.querySelectorAll(
      '[data-testid="row-annotation-bar"]',
    ),
  ).toHaveLength(0)

  const bars = [
    ...renderOverlay(model).container.querySelectorAll(
      '[data-testid="row-annotation-bar"]',
    ),
  ]
  const fillsAt = (x: string) =>
    new Set(
      bars
        .filter(bar => bar.getAttribute('x') === x)
        .map(bar => bar.getAttribute('fill')),
    )
  expect(new Set(bars.map(bar => bar.getAttribute('x')))).toEqual(
    new Set(['0', '4']),
  )
  expect(fillsAt('0').size).toBe(
    new Set(sources.map(row => row.population)).size,
  )
  expect(fillsAt('4').size).toBe(new Set(sources.map(row => row.sex)).size)

  const { getByText } = within(renderKey(model).container)
  getByText('Population')
  getByText('Sex')
  getByText('PopA')
  getByText('female')
})

// Two columns take a label each, worded as their keys are titled, on lines
// the rows start under: on screen (`rowsTopOffset`, the height left for the
// rows) and in the export, which draws the labels just above its rows.
test('rows.annotations labels its columns above rows that start lower, on screen and in the export', () => {
  const sources = [
    { name: 'HG001', population: 'EUR', sex: 'female' },
    { name: 'HG002', population: 'AFR', sex: 'male' },
  ]
  const plain = createDisplay(sources)
  const lone = createDisplay(sources, { annotations: ['sex'] })
  const model = createDisplay(sources, { annotations: ['population', 'sex'] })
  const colored = createDisplay(sources, {
    color: 'population',
    annotations: ['sex'],
  })
  const labelsOf = (display: ReturnType<typeof createDisplay>) =>
    [
      ...renderOverlay(display).container.querySelectorAll(
        '[data-testid="row-column-label"]',
      ),
    ].map(label => label.textContent)
  expect(labelsOf(plain)).toEqual([])
  expect(labelsOf(lone)).toEqual([])
  expect(lone.rowsTopOffset).toBe(plain.rowsTopOffset)
  for (const display of [model, colored]) {
    expect(labelsOf(display)).toEqual(['Population', 'Sex'])
    expect(display.rowColorScales.map(scale => scale.title)).toEqual(
      expect.arrayContaining(['Population', 'Sex']),
    )
    expect(display.rowsTopOffset).toBe(plain.rowsTopOffset + 24)
    expect(display.availableHeight).toBe(plain.availableHeight - 24)
    expect(display.svgControlsStrip).toEqual(plain.svgControlsStrip)
    const { container } = renderOverlay(display)
    const rows = container.querySelector(
      'g:has(> g > [data-testid="row-column-label"])',
    )!.parentElement!
    expect(rows.getAttribute('transform')).toBe(
      `translate(0 ${exportedY(plain, plain.rowsTopOffset) + 24})`,
    )
  }
})
