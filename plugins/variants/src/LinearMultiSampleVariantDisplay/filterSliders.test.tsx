import { readConfObject } from '@jbrowse/core/configuration'
import { fireEvent, render, screen } from '@testing-library/react'

import configSchemaFactory from './configSchema.ts'
import stateModelFactory from './model.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// The MAF/missingness filters are inline slider rows in "Filter by...", wired
// to the config slots the worker reads via rpcProps. (They pass commitOnRelease
// so a real drag only refetches on release; jsdom can't express a mid-drag —
// MUI fires onChangeCommitted straight away for a hidden-input change — so the
// deferral itself is makeSizeMenu's concern, not asserted here.)
describe('multi-sample variant filter sliders', () => {
  function makeModel() {
    const configSchema = configSchemaFactory()
    return stateModelFactory(configSchema).create({
      type: 'LinearMultiSampleVariantDisplay',
      configuration: configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'filter-slider-test',
      }),
    })
  }

  function subMenuOf(item: MenuItem | undefined) {
    return item && 'subMenu' in item ? item.subMenu : []
  }

  // The custom row for one slider inside "Filter by...", by its `label`.
  function sliderRow(model: ReturnType<typeof makeModel>, label: string) {
    const filterBy = model
      .trackMenuItems()
      .find(item => 'label' in item && item.label === 'Filter by...')
    const row = subMenuOf(filterBy).find(
      item => 'label' in item && item.label === label,
    )
    if (row?.type !== 'custom') {
      throw new Error(`no custom slider row labelled ${label}`)
    }
    return row
  }

  it('renders MAF as an off-by-default slider', () => {
    const model = makeModel()
    render(<>{sliderRow(model, 'Minor allele frequency').render(() => {})}</>)

    expect(screen.getByText('MAF: off')).toBeTruthy()
    expect(screen.getByTestId('maf-slider')).toBeTruthy()
  })

  it('commits the MAF slider onto the config slot the worker reads', () => {
    const model = makeModel()
    render(<>{sliderRow(model, 'Minor allele frequency').render(() => {})}</>)

    const input = screen.getByTestId('maf-slider').querySelector('input')!
    fireEvent.change(input, { target: { value: 0.2 } })

    expect(model.minorAlleleFrequencyFilter).toBeCloseTo(0.2)
    expect(
      readConfObject(model.configuration, 'minorAlleleFrequencyFilter'),
    ).toBeCloseTo(0.2)
    expect(screen.getByText('MAF: 0.20')).toBeTruthy()
  })

  // 1 keeps every variant, so the missingness row reads as off at its default
  // rather than at 0 like MAF
  it('renders missingness as off at its keep-everything default', () => {
    const model = makeModel()
    render(<>{sliderRow(model, 'Missingness').render(() => {})}</>)

    expect(screen.getByText('Max missingness: off')).toBeTruthy()

    const input = screen
      .getByTestId('max-missingness-slider')
      .querySelector('input')!
    fireEvent.change(input, { target: { value: 0.3 } })
    expect(model.maxMissingnessFilter).toBeCloseTo(0.3)
  })
})
