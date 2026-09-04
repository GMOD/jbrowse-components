import { applyClusterRun } from './applyClusterRun.ts'

const row = (name: string) => ({ name })

test('lands the layout from the row lists the run started with', async () => {
  const a = row('a')
  const b = row('b')
  const c = row('c')
  const model = {
    editableSources: [a, b, c],
    layout: [] as { name: string }[],
    setLayoutAndClusterTree: jest.fn(),
  }
  await applyClusterRun({
    model,
    rows: [a, b],
    provenance: { regions: [], settings: [] },
    matrix: async () => {
      model.editableSources = [a, b]
      model.layout = [c]
      return { order: [1, 0], tree: '(b,a);' }
    },
  })
  expect(model.setLayoutAndClusterTree).toHaveBeenCalledWith(
    [b, a, c],
    '(b,a);',
    { regions: [], settings: [] },
  )
})
