import { bootAlignmentsDisplay } from './testUtils.ts'

function createDisplay(color: Record<string, unknown>) {
  const { baseSession, mount } = bootAlignmentsDisplay({
    trackConfig: {
      displays: [
        {
          type: 'LinearAlignmentsDisplay',
          displayId: 'd1',
          encoding: { color },
        },
      ],
    },
  })
  const Session = baseSession.volatile(() => ({ rpcManager: {} }))
  return mount(Session, { configuration: 'd1' }).display
}

test("a ramp's domainQuantile reaches the encoding the bake reads", () => {
  const display = createDisplay({
    field: 'tags.XS',
    scale: { type: 'linear', domainQuantile: 0.9 },
  })
  expect(display.colorEncoding).toMatchObject({ domainQuantile: 0.9 })
})

test('the corner notice reads the key members too', () => {
  expect(
    createDisplay({ field: 'strand', scale: { names: ['a', 'b', 'c'] } })
      .notices,
  ).toEqual([
    'encoding.color.scale.names: names gives one value each its name in the key, and 3 names meet 2 values: a name past them names nothing',
  ])
  expect(
    createDisplay({ field: 'strand', scale: { names: ['Fwd', 'Rev'] } })
      .notices,
  ).toEqual([])
})
