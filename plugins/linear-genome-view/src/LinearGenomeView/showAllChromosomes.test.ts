import { zoomMenuItems } from './menuItems.ts'
import { showWholeGenomeLabel } from './showWholeGenome.ts'
import { contigs, openHg38View } from './wholeGenome.fixture.ts'

import type { MenuItem } from '@jbrowse/core/ui'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

async function showWholeGenome(withReport: boolean) {
  const { view, assembly } = await openHg38View({ withReport })
  view.showAllRegionsInAssembly('hg38')
  return {
    shown: view.displayedRegions.map(r => r.refName),
    label: showWholeGenomeLabel(assembly),
  }
}

function subMenuOf(items: MenuItem[], label: string) {
  const row = items.find(r => 'label' in r && r.label === label)
  return row && 'subMenu' in row && Array.isArray(row.subMenu)
    ? row.subMenu
    : []
}

function labels(items: MenuItem[]) {
  return items.map(row => ('label' in row ? row.label : undefined))
}

function click(items: MenuItem[], label: string) {
  const row = items.find(r => 'label' in r && r.label === label)
  if (row && 'onClick' in row) {
    row.onClick()
  }
}

test('an assembly whose sequence report states roles shows its chromosomes', async () => {
  expect(await showWholeGenome(true)).toEqual({
    shown: ['chr1', 'chr2'],
    label: 'Show all chromosomes',
  })
})

test('an assembly stating no roles shows every region', async () => {
  expect(await showWholeGenome(false)).toEqual({
    shown: contigs,
    label: 'Show all regions in assembly',
  })
})

test('the view menu offers every region beside the chromosomes they leave out', async () => {
  const { view } = await openHg38View({ withReport: true })
  view.showAllRegionsInAssembly('hg38')
  const show = subMenuOf(view.menuItems(), 'Show')
  expect(labels(show).slice(0, 2)).toEqual([
    'Show all chromosomes',
    'Show all 6 regions',
  ])
  click(show, 'Show all 6 regions')
  expect(view.displayedRegions.map(r => r.refName)).toEqual(contigs)
})

test('the zoom menu offers the same two rows', async () => {
  const { view } = await openHg38View({ withReport: true })
  view.showAllRegionsInAssembly('hg38')
  expect(labels(zoomMenuItems(view))).toEqual(
    expect.arrayContaining(['Show all chromosomes', 'Show all 6 regions']),
  )
})

test('with no chromosomes to leave regions out, the view menu keeps one row', async () => {
  const { view } = await openHg38View({ withReport: false })
  view.showAllRegionsInAssembly('hg38')
  const show = labels(subMenuOf(view.menuItems(), 'Show'))
  expect(show).toContain('Show all regions in assembly')
  expect(show).not.toContain('Show all 6 regions')
  expect(show).not.toContain('Show all chromosomes')
})
