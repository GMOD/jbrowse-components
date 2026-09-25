import { liftRetiredRowState } from './retiredSettings.ts'

test('a v4 quantitative row answers to its source, and its name is the label', () => {
  expect(
    liftRetiredRowState({
      layout: [
        { name: 'Tumor', source: 'tumor', color: 'red' },
        { name: 'normal', source: 'normal' },
      ],
    }),
  ).toEqual({
    rows: { domain: ['tumor', 'normal'], labels: { tumor: 'Tumor' } },
    rowColor: { domain: ['tumor'], range: ['red'] },
  })
})

test('a later row answers to its name, and carries its label apart', () => {
  expect(
    liftRetiredRowState({
      layout: [{ name: 'HG00096', label: 'first' }, { name: 'HG00097' }],
    }),
  ).toEqual({
    rows: { domain: ['HG00096', 'HG00097'], labels: { HG00096: 'first' } },
  })
})

test('colors: false leaves the colours a copied palette put there', () => {
  expect(
    liftRetiredRowState(
      { layout: [{ name: 'HG00096', color: '#e41a1c' }] },
      { colors: false },
    ),
  ).toEqual({ rows: { domain: ['HG00096'] } })
})

test('the tree, its provenance, the focus and the sidebar come across', () => {
  const clusterProvenance = { regions: [{ refName: 'ctgA', start: 0, end: 9 }] }
  expect(
    liftRetiredRowState({
      clusterTree: '(a:1,b:1);',
      clusterProvenance,
      subtreeFilter: ['a'],
      treeAreaWidth: 120,
      showTreeSetting: false,
      showSidebarLabelsSetting: false,
    }),
  ).toEqual({
    rows: {
      tree: '(a:1,b:1);',
      treeProvenance: clusterProvenance,
      kept: ['a'],
    },
    treeAreaWidth: 120,
    showTree: false,
    showRowLabels: false,
  })
})

test('an instance with no row state lifts nothing', () => {
  expect(liftRetiredRowState({ type: 'LinearWiggleDisplay' })).toEqual({})
})
