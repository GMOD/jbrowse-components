import { cellDataOf } from '../shared/cellData.fixture.ts'
import { findItem } from './menuItem.fixture.ts'
import { RECORDS_BAND_OFF, createTestEnvironment } from './testEnv.ts'

const SAMPLES = ['S0', 'S1', 'S2']
const HAPLOTYPES = ['S0 HP1', 'S0 HP2', 'S1 HP1', 'S1 HP2', 'S2 HP1', 'S2 HP2']

function phasedDisplay(ploidy = 2) {
  const { display } = createTestEnvironment({
    displayConfig: RECORDS_BAND_OFF,
  }).createDisplay()
  display.setRowsField('haplotype')
  display.setSources(SAMPLES.map(name => ({ name })))
  display.setCellData(
    cellDataOf({
      sampleNames: SAMPLES,
      samplePloidy: Object.fromEntries(SAMPLES.map(name => [name, ploidy])),
      hasPhasedOrHaploid: true,
      hasPhaseSet: true,
      hasConsequence: true,
      hasSvType: true,
    }),
  )
  return display
}

function rowNames(display: { drawnRows: { name: string }[] }) {
  return display.drawnRows.map(s => s.name)
}

describe('haplotype rows across a settings refetch', () => {
  it('keeps the haplotype rows while the refetch is in flight', () => {
    const display = phasedDisplay()
    expect(rowNames(display)).toEqual(HAPLOTYPES)

    display.setMaxMissingness(0.5)

    expect(display.cellData).toBeUndefined()
    expect(rowNames(display)).toEqual(HAPLOTYPES)
  })

  it('keeps the choices the last payload offered', () => {
    const display = phasedDisplay()
    display.setFilter(['jexl:get(feature,"QUAL") > 10'])

    expect(display.cellData).toBeUndefined()
    const items = display.trackMenuItems()
    for (const label of [
      'Per haplotype',
      'Phase set',
      'Consequence impact',
      'SV type',
    ]) {
      expect(findItem(items, label)).toMatchObject({ disabled: false })
    }
  })

  it('keeps a haploid ploidy across a payload that read no genotype', () => {
    const display = phasedDisplay(1)
    display.setShowGenotypes(false)
    display.setCellData(cellDataOf())
    display.setShowGenotypes(true)

    expect(display.cellData).toBeUndefined()
    expect(rowNames(display)).toEqual(['S0 HP1', 'S1 HP1', 'S2 HP1'])
  })

  it('opens clustering only on the payload on screen', () => {
    const display = phasedDisplay()
    expect(display.clusteringReady).toBe(true)

    display.setMaxMissingness(0.5)

    expect(display.clusteringReady).toBe(false)
  })

  it('takes the ploidy of the payload that lands', () => {
    const display = phasedDisplay()
    display.setMaxMissingness(0.5)
    display.setCellData(
      cellDataOf({
        sampleNames: SAMPLES,
        samplePloidy: { S0: 1, S1: 2, S2: 2 },
      }),
    )

    expect(rowNames(display)).toEqual([
      'S0 HP1',
      'S1 HP1',
      'S1 HP2',
      'S2 HP1',
      'S2 HP2',
    ])
  })
})
