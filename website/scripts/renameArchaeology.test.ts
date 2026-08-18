/// <reference types="jest" />
// See docFenceRegions.test.ts for why the reference above is here.

/**
 * The detector for a rename that swept the sentence recording itself.
 *
 * Worth pinning because the corpus is at zero and the finding is invisible
 * without it: `RegionTooLargeMixin.ts` carried three of these at once, from one
 * rename, and a hand audit of that file caught only the first. Every rule below
 * is a reason to stay quiet, so a rule that widens costs the check silently.
 */
import { declaresLocally, findRenameArchaeology } from './renameArchaeology.ts'

const found = (text: string) => findRenameArchaeology(text).map(h => h.name)

describe('declaresLocally', () => {
  test('finds the declaration forms these files use', () => {
    expect(
      declaresLocally('export function gateActive() {}', 'gateActive'),
    ).toBe(true)
    expect(declaresLocally('const gateActive = 1', 'gateActive')).toBe(true)
    expect(
      declaresLocally('      get gateActive(): boolean {', 'gateActive'),
    ).toBe(true)
    expect(declaresLocally('  fetchRegions(a) {', 'fetchRegions')).toBe(true)
  })

  test('a mention is not a declaration', () => {
    // The whole point: a rename leaves legitimate mentions everywhere.
    expect(declaresLocally('return self.gateActive && x', 'gateActive')).toBe(
      false,
    )
    expect(declaresLocally('// see gateActive for why', 'gateActive')).toBe(
      false,
    )
  })
})

describe('findRenameArchaeology', () => {
  // The real one, reduced.
  test('flags a rename sentence naming a getter the file declares', () => {
    expect(
      found(`
      /**
       * It was \`gateActive\`, and none of its terms was ever about bytes.
       */
      get gateActive(): boolean {
        return true
      }`),
    ).toEqual(['gateActive'])
  })

  test('flags the wrapped form, where the name lands on the second line', () => {
    expect(
      found(`
      // It was
      // \`gateEnabled\`, which named an implementation detail.
      get gateEnabled() {}`),
    ).toEqual(['gateEnabled'])
  })

  // The form that hid in RegionTooLargeMixin.ts: the name comes first, so
  // looking only after the verb saw nothing.
  test('flags the tautology with the name ahead of the idiom', () => {
    expect(
      found(`
      // Not \`gateExempt\`, which is what it was called while saying "on
      // either axis" in its own first sentence.
      get gateExempt() {}`),
    ).toEqual(['gateExempt'])
  })

  // ...and the same rule stays quiet on ordinary prose that happens to put a
  // live name before a bare "was". Only an explicit naming verb counts.
  test('says nothing when a leading name precedes a non-naming verb', () => {
    expect(
      found(
        '// `gateExempt` was measured at 20kb and left alone.\nget gateExempt() {}',
      ),
    ).toEqual([])
  })

  // The correct spelling of the same sentence, which must stay silent.
  test('says nothing when the sentence names the OLD name', () => {
    expect(
      found(`
      // It was \`byteGateActive\`, and none of its terms was about bytes.
      get gateActive() {}`),
    ).toEqual([])
  })

  test('says nothing about a name mentioned but not declared here', () => {
    expect(
      found('// It was `somethingElse`, renamed upstream.\nconst x = 1'),
    ).toEqual([])
  })

  test('does not fire outside a comment', () => {
    // Prose in a string literal is not a claim about the code.
    expect(
      found('const msg = "it was `gateActive` once"\nget gateActive() {}'),
    ).toEqual([])
  })

  test('reports one hit per name, not one per wrapped line', () => {
    const text = `
      // It was \`gateActive\` and
      // it was \`gateActive\` again and
      // it was \`gateActive\` a third time.
      get gateActive() {}`
    expect(findRenameArchaeology(text)).toHaveLength(1)
  })

  test('skips the file with no rename idiom at all, cheaply', () => {
    expect(found('const gateActive = 1\n// a plain comment')).toEqual([])
  })
})
