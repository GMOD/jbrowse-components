import { alignmentsColorEncoding, colorByOf } from './alignmentsColor.ts'
import { workerColorBy } from './colorSchemes.ts'

test('a field naming no scheme reads as an attribute rather than reaching a lookup that throws', () => {
  for (const field of ['perBaseLettering', 'toString', 'constructor']) {
    const colorBy = colorByOf(
      alignmentsColorEncoding({
        value: undefined,
        field,
        scale: undefined,
        domain: [],
        range: [],
        scheme: undefined,
        reverse: false,
        domainMin: undefined,
        domainMax: undefined,
        domainMid: undefined,
      }),
    )
    expect(colorBy).toEqual({ type: 'tag', attribute: field })
    expect(() => workerColorBy(colorBy)).not.toThrow()
  }
})
