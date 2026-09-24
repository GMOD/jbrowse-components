import { createDisplay } from './testEnv.ts'

const getDisplayName = (name: string) =>
  name === 'GCF_000346465.2' ? 'peach' : name

test('a mate-assembly chip reads the display name', () => {
  const display = createDisplay({ getDisplayName })
  display.setFacet({ field: 'mateAssembly' })
  expect(display.groupChipLabel('GCF_000346465.2')).toBe('peach')
  expect(display.groupChipLabel('arabidopsis')).toBe('arabidopsis')
})

test('another grouping keeps its own label', () => {
  const display = createDisplay({ getDisplayName })
  display.setFacet({ field: 'strand' })
  expect(display.groupChipLabel('GCF_000346465.2')).toBe('GCF_000346465.2')
})
