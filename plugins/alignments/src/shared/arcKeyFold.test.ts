import { arcKeyFoldsIntoReadKey } from './legendUtils.ts'

import type { ReadColorCategory } from '../LinearAlignmentsDisplay/colorUtils.ts'
import type { ArcColorByType, ColorSchemeType } from './types.ts'

// The model's `arcColorsMatchReads` getter is this function, and folding is
// destructive: it drops the curve mark and renders an arc bucket as a plain read
// swatch, asserting the reads paint that color. Every case below is one the
// scheme names alone would get wrong.

function folds(
  arcColorByType: ArcColorByType,
  readColorScheme: ColorSchemeType,
  arc: ReadColorCategory[],
  read: ReadColorCategory[],
) {
  return arcKeyFoldsIntoReadKey({
    arcColorByType,
    readColorScheme,
    arcCategories: new Set(arc),
    readCategories: new Set(read),
  })
}

describe('arcKeyFoldsIntoReadKey', () => {
  it('folds a twin scheme whose buckets the reads all paint', () => {
    expect(
      folds(
        'insertSize',
        'insertSize',
        ['shortInsert', 'longInsert'],
        ['shortInsert', 'longInsert', 'normalInsert'],
      ),
    ).toBe(true)
  })

  it('keeps its own key when the reads are colored by something else', () => {
    expect(
      folds('insertSize', 'strand', ['shortInsert'], ['shortInsert']),
    ).toBe(false)
  })

  // 'orientation' is the arc name for the read scheme's 'pairOrientation' — the
  // one mode spelled differently on the two sides, so a plain equality on the
  // two strings would never fold it.
  it('folds orientation onto pairOrientation', () => {
    expect(
      folds('orientation', 'pairOrientation', ['pairRL'], ['pairRL']),
    ).toBe(true)
    expect(folds('orientation', 'insertSize', ['pairRL'], ['pairRL'])).toBe(
      false,
    )
  })

  // The half that scheme names cannot supply. A split junction colors by its two
  // segments' strands whatever the arc mode, and a non-chain-mode read scheme
  // never reaches those categories — so an SA-split long-read pileup paints arc
  // buckets its reads do not.
  it('refuses when the arcs paint a bucket the reads do not', () => {
    expect(
      folds(
        'insertSizeAndOrientation',
        'insertSizeAndOrientation',
        ['shortInsert', 'splitInversion'],
        ['shortInsert'],
      ),
    ).toBe(false)
  })

  it('folds once the reads reach that bucket too', () => {
    expect(
      folds(
        'insertSizeAndOrientation',
        'insertSizeAndOrientation',
        ['shortInsert', 'splitInversion'],
        ['shortInsert', 'splitInversion'],
      ),
    ).toBe(true)
  })

  // Vacuous on an empty arc key, which is what an overlay drawing nothing has —
  // the model gates the whole question on `readConnections !== 'off'` and the
  // legend being shown, so there is no section to fold either way.
  it('folds vacuously when the arcs paint nothing', () => {
    expect(folds('insertSize', 'insertSize', [], ['shortInsert'])).toBe(true)
  })
})
