import { normalizeSnapshot as anchors } from './MCScanAnchorsAdapter/configSchema.ts'
import { normalizeSnapshot as simple } from './MCScanSimpleAnchorsAdapter/configSchema.ts'

describe('the MCScan shorthand expands each key independently', () => {
  test('all three, which is how the docs write it', () => {
    expect(
      anchors({
        type: 'MCScanAnchorsAdapter',
        uri: 'g.anchors',
        bed1: 'grape.bed',
        bed2: 'peach.bed',
      }),
    ).toMatchObject({
      mcscanAnchorsLocation: { uri: 'g.anchors' },
      bed1Location: { uri: 'grape.bed' },
      bed2Location: { uri: 'peach.bed' },
    })
  })

  // gating all three on each other expanded NONE of them when one was missing,
  // leaving the anchors slot at its /path/to placeholder with nothing drawn and
  // `jbrowse validate` reporting no problem
  test('uri alone still reaches the anchors slot', () => {
    expect(
      anchors({ type: 'MCScanAnchorsAdapter', uri: 'g.anchors' }),
    ).toMatchObject({ mcscanAnchorsLocation: { uri: 'g.anchors' } })
  })

  test('one BED missing leaves only that BED unset', () => {
    expect(
      anchors({
        type: 'MCScanAnchorsAdapter',
        uri: 'g.anchors',
        bed1: 'grape.bed',
      }),
    ).toMatchObject({
      mcscanAnchorsLocation: { uri: 'g.anchors' },
      bed1Location: { uri: 'grape.bed' },
    })
  })

  test('the simple-anchors adapter fills its own slot', () => {
    expect(
      simple({ type: 'MCScanSimpleAnchorsAdapter', uri: 'g.anchors.simple' }),
    ).toMatchObject({
      mcscanSimpleAnchorsLocation: { uri: 'g.anchors.simple' },
    })
  })

  test('a location the config spells out wins over the shorthand', () => {
    expect(
      anchors({
        type: 'MCScanAnchorsAdapter',
        uri: 'g.anchors',
        bed1: 'grape.bed',
        bed1Location: { uri: 'other.bed' },
      }),
    ).toMatchObject({ bed1Location: { uri: 'other.bed' } })
  })

  test('passes a fully-specified snapshot through unchanged', () => {
    const snap = {
      type: 'MCScanAnchorsAdapter',
      mcscanAnchorsLocation: { uri: 'g.anchors', locationType: 'UriLocation' },
    }
    expect(anchors(snap)).toBe(snap)
  })
})
