import { getTrackSelectorMenuItems } from './TrackSelectorMenuButton.tsx'

import type { MenuDivider, MenuItem } from '@jbrowse/core/ui'

type Labeled = Exclude<MenuItem, MenuDivider>

function labeled(items: MenuItem[]) {
  return items.filter((i): i is Labeled => 'label' in i)
}

function labels(items: MenuItem[]) {
  return labeled(items).map(i => i.label)
}

function subLabels(item: MenuItem | undefined) {
  return item && 'subMenu' in item ? labels(item.subMenu) : []
}

function click(items: MenuItem[], label: string) {
  const item = labeled(items).find(i => i.label === label)
  if (item && 'onClick' in item) {
    item.onClick()
  }
}

function makeModel(assemblyNamesPerView: string[][]) {
  return {
    activateTrackSelector: jest.fn(),
    views: assemblyNamesPerView.map(assemblyNames => ({
      assemblyNames,
      activateTrackSelector: jest.fn(),
    })),
  }
}

test('two-genome view lists synteny + row selectors flat', () => {
  const items = getTrackSelectorMenuItems(makeModel([['hg38'], ['mm39']]))
  expect(labels(items)).toEqual([
    'Row 1 → 2 (hg38 → mm39)',
    'Row 1 track selector (hg38)',
    'Row 2 track selector (mm39)',
  ])
  expect(items.some(i => 'subMenu' in i)).toBe(false)
})

test('three+ genomes group the selectors into submenus', () => {
  const items = getTrackSelectorMenuItems(
    makeModel([['hg38'], ['mm39'], ['rn7']]),
  )
  expect(labels(items)).toEqual([
    'Synteny track selectors',
    'Row track selectors',
  ])
  expect(subLabels(items[0])).toEqual([
    'Row 1 → 2 (hg38 → mm39)',
    'Row 2 → 3 (mm39 → rn7)',
  ])
  expect(subLabels(items[1])).toEqual([
    'Row 1 track selector (hg38)',
    'Row 2 track selector (mm39)',
    'Row 3 track selector (rn7)',
  ])
})

test('single view stays flat with no empty synteny submenu', () => {
  const items = getTrackSelectorMenuItems(makeModel([['hg38']]))
  expect(labels(items)).toEqual(['Row 1 track selector (hg38)'])
})

test('clicking a synteny selector activates that level', () => {
  const model = makeModel([['hg38'], ['mm39']])
  click(getTrackSelectorMenuItems(model), 'Row 1 → 2 (hg38 → mm39)')
  expect(model.activateTrackSelector).toHaveBeenCalledWith(0)
})

test('clicking a row selector activates that view', () => {
  const model = makeModel([['hg38'], ['mm39']])
  click(getTrackSelectorMenuItems(model), 'Row 2 track selector (mm39)')
  expect(model.views[1]!.activateTrackSelector).toHaveBeenCalled()
})
