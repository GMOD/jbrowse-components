import { zoomMenuItems } from './menuItems.ts'
import { showWholeGenomeLabel } from './showWholeGenome.ts'
import {
  contigs,
  openHg38View,
  openSalmonellaView,
  salmonellaContigs,
} from './wholeGenome.fixture.ts'

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

test('an assembly whose sequence report states roles shows its assembled molecules', async () => {
  expect(await showWholeGenome(true)).toEqual({
    shown: ['chr1', 'chr2', 'chrM'],
    label: 'Show whole genome (chromosomes, mitochondrion)',
  })
})

test('an assembly stating no roles shows every region', async () => {
  expect(await showWholeGenome(false)).toEqual({
    shown: contigs,
    label: 'Show whole genome',
  })
})

test("a bacterium's whole genome keeps its plasmid and leaves out the unplaced scaffold", async () => {
  const { view, assembly } = await openSalmonellaView()
  view.showAllRegionsInAssembly('LT2')
  expect(view.displayedRegions.map(r => r.refName)).toEqual([
    'chromosome',
    'pSLT',
  ])
  const show = labels(subMenuOf(view.menuItems(), 'Show'))
  expect(show.slice(0, 2)).toEqual([
    'Show whole genome (chromosome, plasmid)',
    `Show all ${salmonellaContigs.length} regions`,
  ])
  expect(showWholeGenomeLabel(assembly)).toBe(show[0])
})

test('the view menu offers every region beside the whole genome that leaves some out', async () => {
  const { view } = await openHg38View({ withReport: true })
  view.showAllRegionsInAssembly('hg38')
  const show = subMenuOf(view.menuItems(), 'Show')
  expect(labels(show).slice(0, 2)).toEqual([
    'Show whole genome (chromosomes, mitochondrion)',
    'Show all 6 regions',
  ])
  click(show, 'Show all 6 regions')
  expect(view.displayedRegions.map(r => r.refName)).toEqual(contigs)
})

test('the zoom menu offers the same two rows', async () => {
  const { view } = await openHg38View({ withReport: true })
  view.showAllRegionsInAssembly('hg38')
  expect(labels(zoomMenuItems(view))).toEqual(
    expect.arrayContaining([
      'Show whole genome (chromosomes, mitochondrion)',
      'Show all 6 regions',
    ]),
  )
})

test('with a whole genome that is every region, the view menu keeps one row', async () => {
  const { view } = await openHg38View({ withReport: false })
  view.showAllRegionsInAssembly('hg38')
  const show = labels(subMenuOf(view.menuItems(), 'Show'))
  expect(show).toContain('Show whole genome')
  expect(show).not.toContain('Show all 6 regions')
})
