import { liftFlatColor, liftRetiredRowState } from './retiredSettings.ts'

test('a v4 quantitative row answers to its source, and its name is the label', () => {
  expect(
    liftRetiredRowState({
      layout: [
        { name: 'Tumor', source: 'tumor', color: 'red' },
        { name: 'normal', source: 'normal' },
      ],
    }),
  ).toEqual({
    rows: { sort: ['tumor', 'normal'], labels: { tumor: 'Tumor' } },
    rowColor: { scale: { domain: ['tumor'], range: ['red'] } },
  })
})

test('a later row answers to its name, and carries its label apart', () => {
  expect(
    liftRetiredRowState({
      layout: [{ name: 'HG00096', label: 'first' }, { name: 'HG00097' }],
    }),
  ).toEqual({
    rows: { sort: ['HG00096', 'HG00097'], labels: { HG00096: 'first' } },
  })
})

test('colors: false leaves the colors a copied palette put there', () => {
  expect(
    liftRetiredRowState(
      { layout: [{ name: 'HG00096', color: '#e41a1c' }] },
      { colors: false },
    ),
  ).toEqual({ rows: { sort: ['HG00096'] } })
})

test('the tree, the focus and the sidebar come across', () => {
  expect(
    liftRetiredRowState({
      clusterTree: '(a:1,b:1);',
      subtreeFilter: ['a'],
      treeAreaWidth: 120,
      showTreeSetting: false,
      showSidebarLabelsSetting: false,
    }),
  ).toEqual({
    rows: {
      tree: '(a:1,b:1);',
      kept: ['a'],
    },
    axis: { width: 120, tree: false, labels: false },
  })
})

test('an instance with no row state lifts nothing', () => {
  expect(liftRetiredRowState({ type: 'LinearWiggleDisplay' })).toEqual({})
})

test('a flat color lifts to the channel, categorical as ordinal', () => {
  expect(
    liftFlatColor(
      {
        field: 'source',
        scale: 'categorical',
        domain: ['EUR'],
        labels: ['European'],
        title: 'Population',
      },
      'value',
    ),
  ).toEqual({
    field: 'source',
    scale: { type: 'ordinal', domain: ['EUR'], names: ['European'] },
    legend: { title: 'Population' },
  })
})

test('a nested scale or legend beside a flat member wins member by member', () => {
  expect(
    liftFlatColor(
      {
        field: 'source',
        scale: { type: 'ordinal', range: ['red'] },
        legend: { title: 'Nested' },
        domain: ['a'],
        title: 'Flat',
      },
      'value',
    ),
  ).toEqual({
    field: 'source',
    scale: { type: 'ordinal', range: ['red'], domain: ['a'] },
    legend: { title: 'Nested' },
  })
})
