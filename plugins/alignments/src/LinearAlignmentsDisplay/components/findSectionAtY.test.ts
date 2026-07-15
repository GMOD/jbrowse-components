import { findSectionAtY } from './findSectionAtY.ts'

// Three stacked groups, each a 50px coverage band over its pileup, content tops
// at 0 / 100 / 200 and total content height 300.
const sections = [
  { groupKey: 'a', coverageTop: 0 },
  { groupKey: 'b', coverageTop: 100 },
  { groupKey: 'c', coverageTop: 200 },
]
const grouped = { isGrouped: true, scrollTop: 0, contentHeight: 300 }

describe('findSectionAtY', () => {
  it('returns undefined when there are no sections', () => {
    expect(findSectionAtY([], 10, grouped)).toBeUndefined()
  })

  it('ungrouped returns the only section at offset 0 for any Y', () => {
    const opts = { isGrouped: false, scrollTop: 0, contentHeight: 300 }
    expect(findSectionAtY(sections, 250, opts)).toEqual({
      section: sections[0],
      coverageTopOffset: 0,
    })
  })

  // The group-by bug: hovering a lower group's coverage must resolve THAT
  // group, not always the top one.
  it('grouped maps a Y in the second band to the second section', () => {
    expect(findSectionAtY(sections, 120, grouped)).toEqual({
      section: sections[1],
      coverageTopOffset: 100,
    })
  })

  it('grouped maps a Y in the last band to the last section', () => {
    expect(findSectionAtY(sections, 250, grouped)).toEqual({
      section: sections[2],
      coverageTopOffset: 200,
    })
  })

  it('grouped subtracts scrollTop from the resolved band top', () => {
    const opts = { isGrouped: true, scrollTop: 80, contentHeight: 300 }
    // Second band now spans screen-Y 20..120; a Y of 30 lands in it.
    expect(findSectionAtY(sections, 30, opts)).toEqual({
      section: sections[1],
      coverageTopOffset: 20,
    })
  })

  it('grouped returns undefined below all content', () => {
    expect(findSectionAtY(sections, 300, grouped)).toBeUndefined()
  })
})
