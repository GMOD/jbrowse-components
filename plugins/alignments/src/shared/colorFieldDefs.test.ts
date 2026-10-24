import { colorFieldKindOf, workerColorField } from './colorFieldDefs.ts'

test('a field naming no scheme reads as an attribute rather than reaching a lookup that throws', () => {
  for (const field of ['perBaseLettering', 'toString', 'constructor']) {
    expect(colorFieldKindOf(field)).toBe('tag')
    expect(workerColorField(field)).toBe(field)
  }
})
