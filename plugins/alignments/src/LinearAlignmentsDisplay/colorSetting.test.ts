import { bootAlignmentsDisplay } from './testUtils.ts'

function createDisplay(color: Record<string, unknown>) {
  const { baseSession, mount } = bootAlignmentsDisplay({
    trackConfig: {
      displays: [{ type: 'LinearAlignmentsDisplay', displayId: 'd1', color }],
    },
  })
  const Session = baseSession.volatile(() => ({ rpcManager: {} }))
  return mount(Session, { configuration: 'd1' }).display
}

test("a ramp's domainQuantile reaches the encoding the bake reads", () => {
  const display = createDisplay({
    field: 'tags.XS',
    scale: 'linear',
    domainQuantile: 0.9,
  })
  expect(display.colorEncoding).toMatchObject({ domainQuantile: 0.9 })
})

test('the corner notice reads the key members too', () => {
  expect(
    createDisplay({ field: 'strand', labels: ['a', 'b', 'c'] }).notices,
  ).toEqual([
    'color.labels: labels names one value each, and 3 labels name 2 values: a label past them names nothing',
  ])
  expect(
    createDisplay({ field: 'strand', labels: ['Fwd', 'Rev'] }).notices,
  ).toEqual([])
})
