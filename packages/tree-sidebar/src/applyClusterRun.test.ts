import { applyClusterRun } from './applyClusterRun.ts'

const row = (name: string) => ({ name })

test('lands the layout from the row lists the run started with', async () => {
  const a = row('a')
  const b = row('b')
  const c = row('c')
  const model = {
    editableSources: [a, b, c],
    rowDomain: [] as string[],
    setRowOrder: jest.fn(),
  }
  await applyClusterRun({
    model,
    rows: [a, b],
    provenance: { regions: [], settings: [] },
    matrix: async () => {
      model.editableSources = [a, b]
      return { order: [1, 0], tree: '(b,a);' }
    },
  })
  expect(model.setRowOrder).toHaveBeenCalledWith([b, a, c], {
    tree: '(b,a);',
    provenance: { regions: [], settings: [] },
  })
})

// A run on a domain-seeded track composes with the seed instead of overwriting
// it: the dendrogram turns towards the declared order and the layout follows
// its leaves, so both the tree and the seed survive the run.
test('rotates the run towards the config domain', async () => {
  const a = row('a')
  const b = row('b')
  const c = row('c')
  const model = {
    editableSources: [a, b, c],
    rowDomain: ['c'],
    setRowOrder: jest.fn(),
  }
  await applyClusterRun({
    model,
    rows: [a, b, c],
    provenance: { regions: [], settings: [] },
    matrix: async () => ({
      order: [0, 1, 2],
      tree: '((a:1,b:1):1,c:2);',
    }),
  })
  const [rows, run] = model.setRowOrder.mock.calls[0]!
  expect(rows).toEqual([c, a, b])
  expect(run.tree).toBe('(c:2,(a:1,b:1):1);')
})
