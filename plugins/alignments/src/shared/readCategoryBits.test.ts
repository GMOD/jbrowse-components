import { cigarStringCategoryBits } from '@jbrowse/cigar-utils'
import PluginManager from '@jbrowse/core/PluginManager'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import BamAdapter from '../BamAdapter/BamAdapter.ts'
import bamConfigSchema from '../BamAdapter/configSchema.ts'
import CramAdapter from '../CramAdapter/CramAdapter.ts'
import {
  getVolvoxSequenceSubAdapter,
  volvoxReference,
} from '../CramAdapter/CramTestAdapters.fixture.ts'
import cramConfigSchema from '../CramAdapter/configSchema.ts'
import { READ_SPLICED } from './readCategoryBits.ts'
import { isSplitAlignment } from './splitAlignment.ts'

import type { MismatchFeature } from './extractCigarFeatures.ts'

const volvox = (file: string) =>
  require.resolve(`../../../../test_data/volvox/${file}`)

function bam(file: string) {
  return new BamAdapter(
    bamConfigSchema.create({
      bamLocation: {
        localPath: volvox(file),
        locationType: 'LocalPathLocation',
      },
      index: {
        location: {
          localPath: volvox(`${file}.bai`),
          locationType: 'LocalPathLocation',
        },
      },
    }),
    getVolvoxSequenceSubAdapter,
    undefined,
    volvoxReference,
  )
}

function cram(file: string) {
  return new CramAdapter(
    cramConfigSchema.create({
      cramLocation: {
        localPath: volvox(file),
        locationType: 'LocalPathLocation',
      },
      craiLocation: {
        localPath: volvox(`${file}.crai`),
        locationType: 'LocalPathLocation',
      },
    }),
    getVolvoxSequenceSubAdapter,
    new PluginManager(),
    volvoxReference,
  )
}

async function reads(adapter: BamAdapter | CramAdapter) {
  const features = await firstValueFrom(
    adapter
      .getFeatures(
        { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 50000 },
        { filterBy: { flagInclude: 0, flagExclude: 0 } },
      )
      .pipe(toArray()),
  )
  return features as unknown as MismatchFeature[]
}

const key = (f: MismatchFeature) =>
  `${f.get('name')}:${f.get('start')}:${f.get('flags')}`

test.each(['volvox-samspec', 'volvox-simple-inv'])(
  '%s: a BAM record and its CRAM twin answer the same CIGAR bits',
  async name => {
    const fromBam = new Map(
      (await reads(bam(`${name}.bam`))).map(f => [key(f), f.cigarCategoryBits]),
    )
    const fromCram = new Map(
      (await reads(cram(`${name}.cram`))).map(f => [
        key(f),
        f.cigarCategoryBits,
      ]),
    )
    expect(fromCram).toEqual(fromBam)
    expect([...fromBam.values()].some(bits => bits !== 0)).toBe(true)
  },
)

test('the packed-CIGAR scan and the CIGAR-string scan agree read for read', async () => {
  const features = await reads(bam('spliced.bam'))
  for (const f of features) {
    expect(f.cigarCategoryBits).toBe(
      cigarStringCategoryBits(f.get('CIGAR') as string),
    )
  }
  expect(features.filter(f => f.cigarCategoryBits & READ_SPLICED)).toHaveLength(
    1740,
  )
})

// The primary of `overlap_split` carries SA on a `300M` CIGAR, which the SAM
// spec does not allow: a chimeric record is clipped. The SA lookup is skipped
// on an unclipped record, so on BAM the primary reads unsplit, and its 0x800
// supplementary split.
test('an unclipped BAM record carrying SA reads unsplit, its supplementary split', async () => {
  const split = (await reads(bam('volvox-overlap.bam')))
    .filter(f => f.get('name') === 'overlap_split')
    .map(f => [f.get('flags'), isSplitAlignment(f)])
  expect(split).toEqual([
    [0, false],
    [2048, true],
  ])
})
