import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Gff3Adapter from './Gff3Adapter/Gff3Adapter.ts'
import gff3ConfigSchema from './Gff3Adapter/configSchema.ts'
import Gff3TabixAdapter from './Gff3TabixAdapter/Gff3TabixAdapter.ts'
import tabixConfigSchema from './Gff3TabixAdapter/configSchema.ts'
import { sequenceLengths } from './originSpanning.ts'

import type { Feature } from '@jbrowse/core/util/simpleFeature'

// pTest is a 1000 bp circular plasmid: a D-loop written 900..1100, and geneB
// 950..1150 with one exon either side of the origin
const adapters = {
  Gff3Adapter: () =>
    new Gff3Adapter(
      gff3ConfigSchema.create({
        gffLocation: {
          localPath: require.resolve('./test_data/origin_spanning.gff3'),
        },
      }),
    ),
  Gff3TabixAdapter: () =>
    new Gff3TabixAdapter(
      tabixConfigSchema.create({
        gffGzLocation: {
          localPath: require.resolve('./test_data/origin_spanning.gff3.gz'),
        },
        index: {
          location: {
            localPath:
              require.resolve('./test_data/origin_spanning.gff3.gz.tbi'),
          },
        },
      }),
    ),
}

function spans(features: Feature[]) {
  return features
    .map(f => ({
      type: f.get('type'),
      start: f.get('start'),
      end: f.get('end'),
      origin: f.id().endsWith('-origin'),
    }))
    .sort((a, b) => a.start - b.start || `${a.type}`.localeCompare(`${b.type}`))
}

describe.each(Object.entries(adapters))('%s', (_name, make) => {
  const fetch = (start: number, end: number) =>
    firstValueFrom(
      make()
        .getFeatures({ refName: 'pTest', start, end, assemblyName: 'p' })
        .pipe(toArray()),
    )

  test('the whole sequence holds both halves of each feature crossing the origin', async () => {
    expect(spans(await fetch(0, 1000))).toEqual([
      { type: 'D_loop', start: 0, end: 100, origin: true },
      { type: 'gene', start: 0, end: 150, origin: true },
      { type: 'region', start: 0, end: 1000, origin: false },
      { type: 'gene', start: 99, end: 300, origin: false },
      { type: 'D_loop', start: 899, end: 1000, origin: false },
      { type: 'gene', start: 949, end: 1000, origin: false },
    ])
  })

  test('a window at the start reaches the part a feature carries past the origin', async () => {
    const features = await fetch(0, 50)
    expect(spans(features)).toEqual([
      { type: 'D_loop', start: 0, end: 100, origin: true },
      { type: 'gene', start: 0, end: 150, origin: true },
      { type: 'region', start: 0, end: 1000, origin: false },
    ])
    const exon = features
      .find(f => f.get('type') === 'gene')!
      .get('subfeatures')![0]!
      .get('subfeatures')!
    expect(exon.map(e => [e.get('start'), e.get('end')])).toEqual([[19, 150]])
  })

  test('a window at the end holds the part before the origin, its exon clipped', async () => {
    const features = await fetch(940, 1000)
    const gene = features.find(f => f.get('type') === 'gene')!
    expect([gene.get('start'), gene.get('end')]).toEqual([949, 1000])
    const mrna = gene.get('subfeatures')![0]!
    expect(
      mrna.get('subfeatures')!.map(e => [e.get('start'), e.get('end')]),
    ).toEqual([[949, 980]])
  })

  test('a window away from the origin holds nothing that crosses it', async () => {
    expect(spans(await fetch(400, 600)).map(s => s.type)).toEqual(['region'])
  })
})

test('a sequence-region pragma names its sequence and its length', () => {
  expect(
    sequenceLengths(
      '##gff-version 3\n##sequence-region NC_012920.1 1 16569\n##sequence-region chr2 1 50',
    ),
  ).toEqual(
    new Map([
      ['NC_012920.1', 16569],
      ['chr2', 50],
    ]),
  )
})
