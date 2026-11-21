import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

import { cellDataOf } from '../shared/cellData.fixture.ts'
import { RECORDS_BAND_OFF, createTestEnvironment } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

const SOURCES = [{ name: 'S0' }, { name: 'S1' }, { name: 'S2' }]
const HAPLOTYPES = ['S0 HP1', 'S0 HP2', 'S1 HP1', 'S1 HP2', 'S2 HP1', 'S2 HP2']

function phasedDisplay() {
  const { display } = createTestEnvironment({
    displayConfig: RECORDS_BAND_OFF,
  }).createDisplay()
  display.setRowsField('haplotype')
  display.setSources(SOURCES)
  display.setCellData(
    cellDataOf({
      samplePloidy: { S0: 2, S1: 2, S2: 2 },
      hasPhasedOrHaploid: true,
      hasPhaseSet: true,
    }),
  )
  return display
}

function rowNames(display: { drawnRows: { name: string }[] }) {
  return display.drawnRows.map(s => s.name)
}

function findItem(items: MenuItem[], label: string): MenuItem | undefined {
  for (const item of items) {
    if ('label' in item && item.label.startsWith(label)) {
      return item
    }
    const found =
      'subMenu' in item ? findItem(resolveSubMenu(item), label) : undefined
    if (found) {
      return found
    }
  }
  return undefined
}

describe('haplotype rows across a settings refetch', () => {
  it('keeps the haplotype rows while the refetch is in flight', () => {
    const display = phasedDisplay()
    expect(rowNames(display)).toEqual(HAPLOTYPES)

    display.setMaxMissingness(0.5)

    expect(display.cellData).toBeUndefined()
    expect(rowNames(display)).toEqual(HAPLOTYPES)
  })

  it('keeps the active per-haplotype and phase set choices offered', () => {
    const display = phasedDisplay()
    display.setFilter(['jexl:get(feature,"QUAL") > 10'])

    expect(display.cellData).toBeUndefined()
    const items = display.trackMenuItems()
    expect(findItem(items, 'Per haplotype')).toMatchObject({
      disabled: false,
    })
    expect(findItem(items, 'Phase set')).toMatchObject({ disabled: false })
  })

  it('takes the ploidy of the payload that lands', () => {
    const display = phasedDisplay()
    display.setMaxMissingness(0.5)
    display.setCellData(cellDataOf({ samplePloidy: { S0: 1, S1: 2, S2: 2 } }))

    expect(rowNames(display)).toEqual([
      'S0 HP1',
      'S1 HP1',
      'S1 HP2',
      'S2 HP1',
      'S2 HP2',
    ])
  })
})
