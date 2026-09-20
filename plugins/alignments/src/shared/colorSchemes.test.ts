import { colorByOf } from './alignmentsColor.ts'
import {
  COLOR_SCHEMES,
  isDataFillScheme,
  workerColorBy,
} from './colorSchemes.ts'

test('a field naming no scheme reads as an attribute rather than reaching a lookup that throws', () => {
  for (const field of ['perBaseLettering', 'toString', 'constructor']) {
    const colorBy = colorByOf({ field, scale: undefined })
    expect(colorBy).toEqual({ type: 'tag', attribute: field })
    expect(() => workerColorBy(colorBy)).not.toThrow()
  }
})

// Spelled out rather than re-derived, because the derivation is what is under
// test: without it the chain-strand framing repaints one of these schemes' whole
// read body forward-red / reverse-blue on every unpaired split read in chain
// mode. A scheme added to the `tag` shader path (`shared/types.ts` invites them)
// joins the list for free; one riding `normal` has to earn it with `perBase`.
test('the schemes whose fill is the datum hold off chain-strand framing', () => {
  expect(
    Object.values(COLOR_SCHEMES)
      .filter(s => isDataFillScheme(s.type))
      .map(s => s.type),
  ).toEqual([
    'mappingQuality',
    'perBaseQuality',
    'perBaseLetter',
    'tag',
    'mateRefName',
    'modifications',
    'bisulfite',
  ])
})
