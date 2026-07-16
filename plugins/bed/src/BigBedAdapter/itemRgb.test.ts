import { featureBedColor } from '@jbrowse/core/util/colorBits'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import BigBedAdapter from './BigBedAdapter.ts'
import configSchema from './configSchema.ts'

// bigBed takes its field names from the file's own embedded autoSql, and UCSC's
// canonical BED autoSql calls the color column `reserved` rather than `itemRgb`
// ("uint reserved; Used as itemRgb as of 2004-11-22"). That is the case #1734
// asks about, so pin the name our own bigBed actually produces — if a @gmod/bbi
// change ever renamed it, automatic coloring would silently stop working here
// while every BED test kept passing.
test('bigBed features carry their color under the autoSql `reserved` name', async () => {
  const adapter = new BigBedAdapter(
    configSchema.create({
      bigBedLocation: {
        localPath: require.resolve('./test_data/volvox.bb'),
        locationType: 'LocalPathLocation',
      },
    }),
  )
  const features = await firstValueFrom(
    adapter
      .getFeatures({
        refName: 'ctgA',
        start: 0,
        end: 50000,
        assemblyName: 'volvox',
      })
      .pipe(toArray()),
  )

  const feature = features[0]!
  expect(feature.get('reserved')).toBe('0,0,0')
  expect(feature.get('itemRgb')).toBeUndefined()

  // volvox.bb only carries the "no color specified" placeholder, so nothing is
  // claimed — the whole point of the placeholder guard
  expect(featureBedColor(feature)).toBeUndefined()
})
