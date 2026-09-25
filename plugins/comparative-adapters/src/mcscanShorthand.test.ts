import { normalizeSnapshot as anchors } from './MCScanAnchorsAdapter/configSchema.ts'
import { normalizeSnapshot as simple } from './MCScanSimpleAnchorsAdapter/configSchema.ts'

describe('the MCScan shorthand expands each key on its own', () => {
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

  // all three used to be required together, so a config naming only some of them
  // expanded NONE: the anchors slot kept its /path/to placeholder and the track
  // drew nothing, with `jbrowse validate` calling the config fine
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

  test('the simple-anchors adapter names its own slot', () => {
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
