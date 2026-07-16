import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import BedTabixAdapter from './BedTabixAdapter.ts'
import MyConfigSchema from './configSchema.ts'

function makeAdapter(f: string) {
  return new BedTabixAdapter(
    MyConfigSchema.create({
      bedGzLocation: {
        localPath: require.resolve(f),
        locationType: 'LocalPathLocation',
      },
      index: {
        location: {
          localPath: require.resolve(`${f}.tbi`),
          locationType: 'LocalPathLocation',
        },
      },
    }),
  )
}

function getFeats(f: string) {
  return firstValueFrom(
    makeAdapter(f)
      .getFeatures({
        refName: 'ctgA',
        start: 0,
        end: 50000,
        assemblyName: 'volvox',
      })
      .pipe(toArray()),
  )
}

// The gene glyph draws one box per subfeature, so what matters is not that the
// top-level feature parsed an itemRgb but that a *drawn* box can reach it.
// getBoxColor walks parent() to do that; this pins the wiring it depends on.
test('a colored BED12 exposes itemRgb to its subfeatures via parent()', async () => {
  const feats = await getFeats('./test_data/volvox-bed12-itemrgb.bed.gz')
  const parent = feats[0]!
  expect(parent.get('itemRgb')).toBe('227,26,28')

  const subfeatures = (parent.get('subfeatures') ?? [])
  expect(subfeatures.length).toBeGreaterThan(0)
  for (const sub of subfeatures) {
    // the box carries no color of its own — it must inherit
    expect(sub.get('itemRgb')).toBeUndefined()
    expect(sub.parent?.()?.get('itemRgb')).toBe('227,26,28')
  }
})

test('the plain BED12 fixture carries only the placeholder', async () => {
  // guards the assumption behind featureItemRgb: ordinary BED12 files fill
  // itemRgb with "0,0,0" rather than omitting it, so honoring it literally
  // would paint this track black
  const feats = await getFeats('./test_data/volvox-bed12.bed.gz')
  expect(feats[0]!.get('itemRgb')).toBe('0,0,0')
})
