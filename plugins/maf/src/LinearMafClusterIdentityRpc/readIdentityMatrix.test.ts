import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import {
  BedTabixAdapter,
  bedTabixConfigSchema as BedTabixConfigSchema,
} from '@jbrowse/plugin-bed'
import { firstValueFrom, from, of } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { generateMafBed } from '../../benches/mafTabixFixture.ts'
import BgzipMafAdapter from '../BgzipMafAdapter/BgzipMafAdapter.ts'
import BgzipMafConfigSchema from '../BgzipMafAdapter/configSchema.ts'
import { parseMafBlocks } from '../BgzipMafAdapter/mafParsing.ts'
import BigMafAdapter from '../BigMafAdapter/BigMafAdapter.ts'
import BigMafConfigSchema from '../BigMafAdapter/configSchema.ts'
import MafFeature from '../MafFeature.ts'
import MafTabixAdapter from '../MafTabixAdapter/MafTabixAdapter.ts'
import MafTabixConfigSchema from '../MafTabixAdapter/configSchema.ts'
import {
  legacyBigMafFeatures,
  legacyIdentityMatrix,
  legacyMafTabixFeatures,
} from '../util/legacyMafParse.fixture.ts'
import { featureBlocks } from '../util/mafBlockSink.ts'
import { makeSourceResolver } from '../util/parseAssemblyName.ts'
import { readIdentityMatrix } from './buildIdentityMatrix.ts'

import type { MafAdapterBase } from '../util/MafAdapterBase.ts'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'
import type { Observable } from 'rxjs'

interface BedBlock {
  id: string
  refName: string
  start: number
  end: number
  entries: string
}

const overlaps = (b: BedBlock, r: Region) =>
  b.refName === r.refName && b.start < r.end && b.end > r.start

function subAdapter(blocks: BedBlock[], field: (b: BedBlock) => string) {
  return {
    getFeatures: (r: Region) =>
      of(
        ...blocks
          .filter(b => overlaps(b, r))
          .map(
            b =>
              new SimpleFeature({
                uniqueId: b.id,
                refName: b.refName,
                start: b.start,
                end: b.end,
                field5: field(b),
                mafBlock: field(b),
              }),
          ),
      ),
  } as unknown as BaseFeatureDataAdapter
}

const loader = (dataAdapter: BaseFeatureDataAdapter) => () =>
  Promise.resolve({ dataAdapter, sessionIds: new Set<string>() })

const sLines = (b: BedBlock) =>
  b.entries.split(',').map(entry => {
    const [src, start, size, strand, srcSize, seq] = entry.split(':')
    return `s ${src} ${start} ${size} ${strand} ${srcSize} ${seq}`
  })

type Read = (r: Region) => Observable<Feature>

// The same blocks through each of the three reads, MAF-tabix's and bigMaf's
// parse into the sink and a bgzip MAF's parsed stanzas through `featureBlocks`,
// each beside the MafFeatures clustering read before.
function adaptersOver(blocks: BedBlock[]): [MafAdapterBase, Read][] {
  const bed = subAdapter(blocks, b => b.entries)
  const tabix = new MafTabixAdapter(
    MafTabixConfigSchema.create({}),
    loader(bed),
  )
  const bigBed = subAdapter(blocks, b => ['a score=0', ...sLines(b)].join(';'))
  const bigMaf = new BigMafAdapter(
    BigMafConfigSchema.create({}),
    loader(bigBed),
  )
  const bgzip = new BgzipMafAdapter(BgzipMafConfigSchema.create({}))
  const text = blocks
    .map(b => ['a score=0', ...sLines(b), ''].join('\n'))
    .join('\n')
  const parsed = [
    ...parseMafBlocks(`${text}\n`, makeSourceResolver().resolve),
  ].map(
    (b, i) =>
      new MafFeature(
        b.uniqueId,
        b.start,
        b.end,
        blocks[i]!.refName,
        b.strand,
        b.alignments,
        b.seq,
        b.empties,
      ),
  )
  const parsedOver: Read = r =>
    from(parsed.filter(f => f.get('start') < r.end && f.get('end') > r.start))
  jest
    .spyOn(bgzip, 'readBlocks')
    .mockImplementation((r, sink) => featureBlocks(parsedOver(r), sink))
  return [
    [tabix, r => legacyMafTabixFeatures(bed, r)],
    [bigMaf, r => legacyBigMafFeatures(bigBed, r)],
    [bgzip, parsedOver],
  ]
}

function bedBlocks(text: string): BedBlock[] {
  return text
    .trimEnd()
    .split('\n')
    .map(line => {
      const [refName, start, end, id, , entries] = line.split('\t')
      return {
        id: id!,
        refName: refName!,
        start: +start!,
        end: +end!,
        entries: entries!,
      }
    })
}

async function volvoxBlocks() {
  const fixture = (name: string) =>
    require.resolve(`../../../../test_data/volvox/${name}`)
  const bed = new BedTabixAdapter(
    BedTabixConfigSchema.create({
      bedGzLocation: {
        localPath: fixture('volvox.maf.bed.gz'),
        locationType: 'LocalPathLocation',
      },
      index: {
        location: {
          localPath: fixture('volvox.maf.bed.gz.tbi'),
          locationType: 'LocalPathLocation',
        },
      },
    }),
  )
  const features: Feature[] = await firstValueFrom(
    bed
      .getFeatures({
        refName: 'ctgA',
        start: 0,
        end: 60000,
        assemblyName: 'volvox',
      })
      .pipe(toArray()),
  )
  return features.map(f => ({
    id: f.id(),
    refName: 'ctgA',
    start: f.get('start'),
    end: f.get('end'),
    entries: f.get('field5') as string,
  }))
}

const matrixView = (m: Map<string, Float32Array>) =>
  [...m].map(([name, row]) => [name, [...row]])

async function expectMatricesEqual(
  blocks: BedBlock[],
  regions: Region[],
  sources: string[],
) {
  for (const [adapter, legacyRead] of adaptersOver(blocks)) {
    const sink = await readIdentityMatrix(adapter, regions, sources)
    const legacy = await legacyIdentityMatrix(legacyRead, regions, sources)
    expect(matrixView(sink)).toStrictEqual(matrixView(legacy))
  }
}

test('the volvox MAF clusters to the matrix its MafFeatures did', async () => {
  const blocks = await volvoxBlocks()
  expect(blocks.length).toBeGreaterThan(400)
  const regions = [
    { refName: 'ctgA', start: 0, end: 20000, assemblyName: 'volvox' },
    { refName: 'ctgA', start: 20000, end: 50001, assemblyName: 'volvox' },
  ]
  const sources = [
    'volvox',
    'simvolvox',
    'minivolvox',
    'nanovolvox',
    'picovolvox',
    'never-seen',
  ]
  await expectMatricesEqual(blocks, regions, sources)
  const [tabix] = adaptersOver(blocks)[0]!
  const m = await readIdentityMatrix(tabix, regions, sources)
  expect(m.get('volvox')!.every(v => v === 1)).toBe(true)
  const sim = m.get('simvolvox')!
  expect(sim.some(v => v > 0 && v < 1)).toBe(true)
  expect(m.get('never-seen')!.every(v => v === 0)).toBe(true)
})

test('the synthetic MAF-tabix blocks cluster to the matrix their MafFeatures did', async () => {
  const blocks = bedBlocks(
    generateMafBed({
      blocks: 60,
      species: 7,
      columns: 40,
      refGapRate: 0.1,
      spacing: 50,
      seed: 3,
    }).text,
  )
  const sources = ['sp6', 'sp0', 'sp3', 'sp1']
  await expectMatricesEqual(
    blocks,
    [{ refName: 'chr1', start: 0, end: 3000, assemblyName: 'test' }],
    sources,
  )
  await expectMatricesEqual(
    blocks,
    [{ refName: 'chr1', start: 10, end: 17, assemblyName: 'test' }],
    sources,
  )
})
