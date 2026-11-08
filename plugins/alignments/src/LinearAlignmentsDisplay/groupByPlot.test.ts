import { bootAlignmentsDisplay } from './testUtils.ts'

function createDisplay(displayConfig: Record<string, unknown> = {}) {
  const { baseSession, mount } = bootAlignmentsDisplay({
    trackConfig: {
      displays: [
        { type: 'LinearAlignmentsDisplay', displayId: 'd1', ...displayConfig },
      ],
    },
  })
  const Session = baseSession.volatile(() => ({ rpcManager: {} }))
  return mount(Session, { configuration: 'd1' }).display
}

test('Edit plot shows the grouping and its color as one draft', () => {
  const display = createDisplay()
  expect(display.groupByPlot('tags.HP', true)).toEqual({
    facet: { field: 'tags.HP' },
    encoding: { color: { field: 'tags.HP' } },
  })
  expect(display.groupByPlot('tags.HP', false)).toEqual({
    facet: { field: 'tags.HP' },
  })
})

test('applying groups and colors by the tag, and unticking takes the color back', () => {
  const display = createDisplay()
  display.applyGroupBy('tags.HP', true)
  expect(display.facet?.field).toBe('tags.HP')
  expect(display.colorField).toBe('tags.HP')
  display.applyGroupBy('tags.HP', false)
  expect(display.facet?.field).toBe('tags.HP')
  expect(display.colorField).toBeUndefined()
})

// Unticking speaks only for the tag in the box: another tag's colors, and a
// constant kept beside the field, stay.
test('unticking leaves another field and a hand-picked constant alone', () => {
  const display = createDisplay({ encoding: { color: { field: 'tags.RG' } } })
  display.applyGroupBy('tags.HP', false)
  expect(display.colorField).toBe('tags.RG')

  const solid = createDisplay({ encoding: { color: { value: 'purple' } } })
  solid.applyGroupBy('tags.HP', true)
  expect(solid.colorField).toBe('tags.HP')
  solid.applyGroupBy('tags.HP', false)
  expect(solid.colorField).toBeUndefined()
  expect(solid.writtenColor.value).toBe('purple')
})

test('regrouping by the field already grouping keeps its section order', () => {
  const display = createDisplay({
    facet: { field: 'tags.HP', sort: ['2', '1'] },
  })
  display.applyGroupBy('tags.HP', true)
  expect(display.facet?.sort).toEqual(['2', '1'])
})
