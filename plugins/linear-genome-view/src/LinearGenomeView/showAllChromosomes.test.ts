import { createTestSession } from '@jbrowse/web/testUtils'

import { showWholeGenomeLabel } from './showWholeGenome.ts'

import type { LinearGenomeViewModel } from './index.ts'
import type { MenuItem } from '@jbrowse/core/ui'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const report =
  require.resolve('../../../config/src/NcbiSequenceReportAliasAdapter/test_data/sequence_report.tsv')

const contigs = [
  'chr1',
  'chr1_KI270706v1_random',
  'chr2',
  'chrM',
  'chrUn_GL000195v1',
  'chr1_GL383518v1_alt',
]

function addAssembly(
  session: ReturnType<typeof createTestSession>,
  name: string,
  withReport: boolean,
) {
  session.addAssemblyConf({
    name,
    sequence: {
      trackId: `${name}-seq`,
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: contigs.map(refName => ({
          refName,
          uniqueId: refName,
          start: 0,
          end: 10_000,
        })),
      },
    },
    ...(withReport
      ? {
          refNameAliases: {
            adapter: {
              type: 'NcbiSequenceReportAliasAdapter',
              location: {
                localPath: report,
                locationType: 'LocalPathLocation',
              },
            },
          },
        }
      : {}),
  })
}

async function openView(withReport: boolean) {
  const session = createTestSession()
  addAssembly(session, 'hg38', withReport)
  const assembly = await session.assemblyManager.waitForAssembly('hg38')
  const view = session.addView('LinearGenomeView', {}) as LinearGenomeViewModel
  view.setWidth(800)
  return { view, assembly }
}

async function showWholeGenome(withReport: boolean) {
  const { view, assembly } = await openView(withReport)
  view.showAllRegionsInAssembly('hg38')
  return {
    shown: view.displayedRegions.map(r => r.refName),
    label: showWholeGenomeLabel(assembly),
  }
}

// the row a label names anywhere in a menu, submenus included
function findRow(items: MenuItem[], label: string): MenuItem | undefined {
  return items
    .map(item =>
      'label' in item && item.label === label
        ? item
        : 'subMenu' in item
          ? findRow(
              typeof item.subMenu === 'function'
                ? item.subMenu()
                : item.subMenu,
              label,
            )
          : undefined,
    )
    .find(item => item !== undefined)
}

function rowLabels(item: MenuItem | undefined) {
  return item && 'subMenu' in item && Array.isArray(item.subMenu)
    ? item.subMenu.map(row => ('label' in row ? row.label : undefined))
    : undefined
}

function click(item: MenuItem | undefined) {
  if (item && 'onClick' in item) {
    item.onClick()
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
  const { view } = await openView(true)
  view.showAllRegionsInAssembly('hg38')
  const items = view.menuItems()
  expect(rowLabels(findRow(items, 'Show whole genome'))).toEqual([
    'Show all chromosomes',
    'Show all 6 regions',
  ])
  click(findRow(items, 'Show all 6 regions'))
  expect(view.displayedRegions.map(r => r.refName)).toEqual(contigs)
})

test('with no chromosomes to leave regions out, the view menu keeps one row', async () => {
  const { view } = await openView(false)
  view.showAllRegionsInAssembly('hg38')
  const items = view.menuItems()
  expect(findRow(items, 'Show whole genome')).toBeUndefined()
  expect(findRow(items, 'Show all regions in assembly')).toBeDefined()
})
