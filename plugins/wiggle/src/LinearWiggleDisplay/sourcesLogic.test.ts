import { buildSources } from './sourcesLogic.ts'

import type { Source } from '../util.ts'

// Each list stands in for the display's `editableSources` and each map for its
// `resolvedRowColors`, both tree-sidebar's; what's left here is where wiggle
// lands a row's colour.
const editable: Source[] = [
  { name: 'a', color: '#0a0a0a', labelColor: '#a0a0a0' },
  { name: 'b' },
  { name: 'c', labelColor: '#c0c0c0' },
]
const resolved = new Map([
  ['a', '#0a0a0a'],
  ['b', '#0000ff'],
])

describe('buildSources', () => {
  it('lands each row its resolved colour on the plot, none where it has none', () => {
    const out = buildSources(editable, undefined, resolved, 'color')
    expect(out.map(s => s.color)).toEqual(['#0a0a0a', '#0000ff', undefined])
    expect(out.map(s => s.labelColor)).toEqual([
      '#a0a0a0',
      undefined,
      '#c0c0c0',
    ])
  })

  it('lands it on the label tint, leaving the plot its own colour', () => {
    const out = buildSources(editable, undefined, resolved, 'labelColor')
    expect(out.map(s => s.color)).toEqual(['#0a0a0a', undefined, undefined])
    expect(out.map(s => s.labelColor)).toEqual([
      '#0a0a0a',
      '#0000ff',
      '#c0c0c0',
    ])
  })

  it('narrows to the focus without recolouring the kept rows', () => {
    const out = buildSources(editable, ['b'], resolved, 'color')
    expect(out).toEqual([{ name: 'b', color: '#0000ff' }])
  })
})
