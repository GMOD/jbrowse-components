import { rowOrderMenuItems } from './rowArrangementMenuItem.ts'

type Model = Parameters<typeof rowOrderMenuItems>[0]

function labels(rowArrangementIsCustom: boolean, cluster: boolean) {
  const model = {
    rowArrangementIsCustom,
    resetRowArrangement: () => {},
    setRowFocus: () => {},
    setScrollTop: () => {},
  } as unknown as Model
  return rowOrderMenuItems(model, {
    arrangement: { ready: true, onOpen: () => {} },
    cluster: cluster
      ? { runItem: { label: 'Cluster...', onClick: () => {} }, rowCount: 2 }
      : undefined,
  }).map(i => ('label' in i ? i.label : ''))
}

test('the row order items come in one order', () => {
  expect(labels(true, true)).toEqual([
    'Edit colors/arrangement...',
    'Reset row order',
    'Clustering',
  ])
})

test('reset waits for a custom order, and clustering for a display that clusters', () => {
  expect(labels(false, false)).toEqual(['Edit colors/arrangement...'])
})
