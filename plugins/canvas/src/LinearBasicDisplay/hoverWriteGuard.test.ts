import { createTestEnvironment } from './testEnv.ts'

// `mouseoverExtraInformation` is a fresh array on every hit, and a fresh array
// is a fresh observable identity — so an unguarded write re-renders
// `FeatureTooltip` on every raw mousemove while the cursor rests on one feature,
// with identical rows each time. The pointer path is coalesced to one frame now,
// but a frame is still a write, and this is the half that makes a settled hover
// cost nothing at all.
//
// Object identity, not `toEqual`: equal contents written anyway is exactly the
// bug, and it is invisible to a value comparison.
function setup() {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  return display
}

describe('setHover write guard', () => {
  it('keeps the tooltip array identity when the rows are unchanged', () => {
    const display = setup()
    display.setHover('f1', null, ['gene1', 'ctgA:1..100'])
    const first = display.mouseoverExtraInformation
    display.setHover('f1', null, ['gene1', 'ctgA:1..100'])
    expect(display.mouseoverExtraInformation).toBe(first)
  })

  it('writes when a row changes', () => {
    const display = setup()
    display.setHover('f1', null, ['gene1', 'ctgA:1..100'])
    display.setHover('f1', null, ['gene1', 'ctgA:1..200'])
    expect(display.mouseoverExtraInformation).toEqual(['gene1', 'ctgA:1..200'])
  })

  it('writes when the row count changes', () => {
    const display = setup()
    display.setHover('f1', null, ['gene1'])
    display.setHover('f1', null, ['gene1', 'exon 2/5'])
    expect(display.mouseoverExtraInformation).toEqual(['gene1', 'exon 2/5'])
  })

  it('writes when the tooltip appears or goes away', () => {
    const display = setup()
    display.setHover('f1', null, undefined)
    expect(display.mouseoverExtraInformation).toBeUndefined()
    display.setHover('f1', null, ['gene1'])
    expect(display.mouseoverExtraInformation).toEqual(['gene1'])
    display.setHover(null, null, undefined)
    expect(display.mouseoverExtraInformation).toBeUndefined()
  })

  it('still moves the ids while the rows hold', () => {
    const display = setup()
    display.setHover('f1', 'sub1', ['gene1'])
    const rows = display.mouseoverExtraInformation
    // two features whose tooltips happen to read the same — the guard is about
    // the array, and must not pin the hover itself
    display.setHover('f2', 'sub2', ['gene1'])
    expect(display.featureIdUnderMouse).toBe('f2')
    expect(display.subfeatureIdUnderMouse).toBe('sub2')
    expect(display.mouseoverExtraInformation).toBe(rows)
  })
})
