import { parseHubShortLabel } from './loadLinkSpec.ts'

// loadLinkSpec itself is driven against jbrowse-web's real session model in
// products/jbrowse-web/src/hubLinkSession.test.ts
describe('parseHubShortLabel', () => {
  it('extracts the shortLabel value', () => {
    expect(
      parseHubShortLabel('hub myHub\nshortLabel My Cool Hub\nlongLabel x'),
    ).toBe('My Cool Hub')
  })

  it('returns undefined when there is no shortLabel line', () => {
    expect(parseHubShortLabel('hub myHub\nlongLabel x')).toBeUndefined()
  })
})
