import { viewTitle } from './viewTitle.ts'

describe('viewTitle', () => {
  const getDisplayName = (name: string) => `${name} display`

  it('prefers an explicit displayName', () => {
    expect(
      viewTitle(
        { displayName: 'my view', assemblyNames: ['volvox'], minimized: false },
        getDisplayName,
      ),
    ).toBe('my view')
  })

  it('joins assembly display names', () => {
    expect(
      viewTitle(
        { assemblyNames: ['volvox', 'volvox2'], minimized: false },
        getDisplayName,
      ),
    ).toBe('volvox display,volvox2 display')
  })

  it('falls back to Untitled view when assemblyNames is empty', () => {
    // an LGV with no displayedRegions has assemblyNames === [], not undefined
    expect(viewTitle({ assemblyNames: [], minimized: false }, getDisplayName)).toBe(
      'Untitled view',
    )
  })

  it('falls back to Untitled view when assemblyNames is absent', () => {
    expect(viewTitle({ minimized: false }, getDisplayName)).toBe('Untitled view')
  })

  it('annotates a minimized view', () => {
    expect(
      viewTitle({ assemblyNames: ['volvox'], minimized: true }, getDisplayName),
    ).toBe('volvox display (minimized)')
  })

  it('does not annotate a minimized view that has a displayName', () => {
    expect(
      viewTitle({ displayName: 'my view', minimized: true }, getDisplayName),
    ).toBe('my view')
  })
})
