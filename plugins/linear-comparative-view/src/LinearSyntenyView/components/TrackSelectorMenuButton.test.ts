import { getTrackSelectorMenuItems } from './TrackSelectorMenuButton.tsx'

import type { MenuDivider, MenuItem } from '@jbrowse/core/ui'

type Labeled = Exclude<MenuItem, MenuDivider>

function labeled(items: MenuItem[]) {
  return items.filter((i): i is Labeled => 'label' in i)
}

function labels(items: MenuItem[]) {
  return labeled(items).map(i =>
    i.type === 'subHeader' ? `[${i.label}]` : i.label,
  )
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

test('a two-genome view names each row once, under a heading', () => {
  const items = getTrackSelectorMenuItems(makeModel([['hg38'], ['mm39']]))
  expect(labels(items)).toEqual([
    '[Synteny tracks]',
    'hg38 → mm39',
    '[Genome row tracks]',
    'hg38',
    'mm39',
  ])
})

test('more genomes stay in the same flat shape', () => {
  // one shape at every row count: the submenu version this replaced forced
  // every label to carry its own group name to stay legible when flattened
  const items = getTrackSelectorMenuItems(
    makeModel([['hg38'], ['mm39'], ['rn7']]),
  )
  expect(labels(items)).toEqual([
    '[Synteny tracks]',
    'hg38 → mm39',
    'mm39 → rn7',
    '[Genome row tracks]',
    'hg38',
    'mm39',
    'rn7',
  ])
  expect(items.some(i => 'subMenu' in i)).toBe(false)
})

test('a single view carries no empty synteny heading', () => {
  expect(labels(getTrackSelectorMenuItems(makeModel([['hg38']])))).toEqual([
    '[Genome row tracks]',
    'hg38',
  ])
})

test('a row still loading its assembly is named by position', () => {
  expect(labels(getTrackSelectorMenuItems(makeModel([['hg38'], []])))).toEqual([
    '[Synteny tracks]',
    'hg38 → Row 2',
    '[Genome row tracks]',
    'hg38',
    'Row 2',
  ])
})

test('a stack holding one assembly twice numbers the repeat', () => {
  // two rows on the same genome (two loci, or a read against its own reference)
  // otherwise give two entries that open different selectors under one label
  const items = getTrackSelectorMenuItems(
    makeModel([['peach'], ['grape'], ['peach']]),
  )
  expect(labels(items)).toEqual([
    '[Synteny tracks]',
    'peach (row 1) → grape',
    'grape → peach (row 3)',
    '[Genome row tracks]',
    'peach (row 1)',
    'grape',
    'peach (row 3)',
  ])
})

test('clicking a synteny row activates that level', () => {
  const model = makeModel([['hg38'], ['mm39']])
  click(getTrackSelectorMenuItems(model), 'hg38 → mm39')
  expect(model.activateTrackSelector).toHaveBeenCalledWith(0)
})

test('clicking a genome row activates that view', () => {
  const model = makeModel([['hg38'], ['mm39']])
  // the synteny entry above spells the same assembly names, so the row entry
  // has to be the one matched — an `includes` here would fire the wrong one
  click(getTrackSelectorMenuItems(model), 'mm39')
  expect(model.views[1]!.activateTrackSelector).toHaveBeenCalled()
  expect(model.activateTrackSelector).not.toHaveBeenCalled()
})
