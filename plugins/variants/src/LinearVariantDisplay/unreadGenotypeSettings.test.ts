import { createTestEnvironment } from './testEnv.ts'

const SOURCES = [{ name: 'S0' }, { name: 'S1' }]

function displayWith(genotypesShow: boolean) {
  const { display } = createTestEnvironment({
    displayConfig: { genotypes: { show: genotypesShow } },
  }).createDisplay()
  display.setSources(SOURCES)
  return display
}

function changeGenotypeSettings(display: ReturnType<typeof displayWith>) {
  display.setRowsField('haplotype')
  display.setShowReference(true)
  display.setMinMinorAlleleFrequency(0.1)
  display.setMaxMissingness(0.5)
}

describe('genotype settings the worker does not read', () => {
  it('leave the fetch key alone while genotypes are hidden', () => {
    const display = displayWith(false)
    expect(display.rpcProps().sampleFilter).toEqual([])
    const key = display.rpcProps()

    changeGenotypeSettings(display)

    expect(display.rpcProps()).toEqual(key)
  })

  it('refetch while genotypes draw', () => {
    const display = displayWith(true)
    const key = display.rpcProps()

    changeGenotypeSettings(display)

    expect(display.rpcProps()).toMatchObject({
      rowsField: 'haplotype',
      showReference: true,
      siteFilter: [{ field: 'minorAlleleFrequency' }, { field: 'missingness' }],
    })
    expect(display.rpcProps()).not.toEqual(key)
  })
})
