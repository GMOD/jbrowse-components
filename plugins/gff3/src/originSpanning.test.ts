import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import {
  originTailCandidates,
  wholeSubfeatureId,
} from '@jbrowse/core/util/originCut'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { originCrossingLength } from '../../../packages/core/src/BaseFeatureWidget/SequenceFeatureDetails/util.ts'
import { stringifyGFF3 } from '../../../packages/core/src/pluggableElementTypes/models/saveTrackFileTypes/gff3.ts'
import { declaredCircularLengths } from '../../../packages/core/src/pluggableElementTypes/models/saveTrackFileTypes/util.ts'
import CoreGetEncodedFeature from '../../../packages/core/src/rpc/methods/CoreGetEncodedFeature.ts'
import GetBasicFeatureDetails from '../../../packages/core/src/rpc/methods/GetBasicFeatureDetails.ts'
import Gff3Adapter from './Gff3Adapter/Gff3Adapter.ts'
import gff3ConfigSchema from './Gff3Adapter/configSchema.ts'
import Gff3TabixAdapter from './Gff3TabixAdapter/Gff3TabixAdapter.ts'
import tabixConfigSchema from './Gff3TabixAdapter/configSchema.ts'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
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

function reloaded(gff3: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'origin-spanning-'))
  const file = path.join(dir, 'exported.gff3')
  fs.writeFileSync(file, gff3)
  return new Gff3Adapter(
    gff3ConfigSchema.create({ gffLocation: { localPath: file } }),
  )
}

function spans(features: Feature[]) {
  return features
    .map(f => ({
      type: f.get('type'),
      start: f.get('start'),
      end: f.get('end'),
      origin: f.id().endsWith('-origin'),
    }))
    .sort(
      (a, b) =>
        a.start - b.start ||
        `${a.type}`.localeCompare(`${b.type}`) ||
        a.end - b.end,
    )
}

describe.each(Object.entries(adapters))('%s', (_name, make) => {
  const fetch = (
    start: number,
    end: number,
    refName = 'pTest',
    opts: BaseOptions = {},
  ) =>
    firstValueFrom(
      make()
        .getFeatures({ refName, start, end, assemblyName: 'p' }, opts)
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

  test('a sequence-region pragma alone does not make a sequence circular', async () => {
    expect(spans(await fetch(0, 1000, 'pLinear'))).toEqual([
      { type: 'region', start: 0, end: 1000, origin: false },
      { type: 'gene', start: 949, end: 1100, origin: false },
    ])
  })

  test('the Is_circular line gives the length when no pragma does', async () => {
    expect(spans(await fetch(0, 30, 'pCds'))).toEqual([
      { type: 'gene', start: 0, end: 10, origin: true },
      { type: 'gene', start: 0, end: 20, origin: true },
      { type: 'region', start: 0, end: 1000, origin: false },
    ])
  })

  test('a CDS piece that lost bases off its 5′ end has its phase moved on', async () => {
    const cdsPhase = (features: Feature[], strand: number) =>
      features
        .find(f => f.get('type') === 'gene' && f.get('strand') === strand)
        ?.get('subfeatures')?.[0]
        ?.get('phase')
    const head = await fetch(985, 1000, 'pCds')
    const tail = await fetch(0, 30, 'pCds')
    expect(cdsPhase(head, 1)).toBe(0)
    expect(cdsPhase(tail, 1)).toBe(1)
    expect(cdsPhase(head, -1)).toBe(1)
    expect(cdsPhase(tail, -1)).toBe(2)
  })

  test('asked for whole features, a window at the start answers each one uncut under its own id', async () => {
    const features = await fetch(0, 50, 'pTest', { wholeAcrossOrigin: true })
    expect(spans(features)).toEqual([
      { type: 'region', start: 0, end: 1000, origin: false },
      { type: 'D_loop', start: 899, end: 1100, origin: false },
      { type: 'gene', start: 949, end: 1150, origin: false },
    ])
    const gene = features.find(f => f.get('type') === 'gene')!
    expect(
      gene
        .get('subfeatures')![0]!
        .get('subfeatures')!
        .map(e => [e.get('start'), e.get('end')]),
    ).toEqual([
      [949, 980],
      [1019, 1150],
    ])
  })

  test('a piece names each child as the whole feature does', async () => {
    const tailGene = (await fetch(0, 50)).find(f => f.get('type') === 'gene')!
    const tailExon = tailGene.get('subfeatures')![0]!.get('subfeatures')![0]!
    const wholeGene = (
      await fetch(0, 50, 'pTest', { wholeAcrossOrigin: true })
    ).find(f => f.get('type') === 'gene')!
    const wholeExons = wholeGene.get('subfeatures')![0]!.get('subfeatures')!
    expect(wholeSubfeatureId(tailGene.id(), tailExon.id())).toBe(
      wholeExons[1]!.id(),
    )
    expect(originTailCandidates(wholeExons[1]!.id())).toContain(tailExon.id())
    expect(originTailCandidates(wholeGene.id())).toContain(tailGene.id())
  })

  // as a display leaves out NCBI's gbkey=Src region line
  test('a whole sequence exported as GFF3 without its region line loads back with the same pieces', async () => {
    const fetched = (
      await fetch(0, 1000, 'pTest', { wholeAcrossOrigin: true })
    ).map(f => new SimpleFeature(f.toJSON()))
    const exported = stringifyGFF3({
      features: fetched.filter(f => f.get('type') !== 'region'),
      circularLengths: declaredCircularLengths(fetched),
    })
    const features = await firstValueFrom(
      reloaded(exported)
        .getFeatures({ refName: 'pTest', start: 0, end: 1000 })
        .pipe(toArray()),
    )
    expect(spans(features)).toEqual(spans(await fetch(0, 1000)))
  })
})

describe('feature details read with no assembly to say which sequence is circular', () => {
  const pluginManager = new PluginManager()
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'Gff3Adapter',
        configSchema: gff3ConfigSchema,
        getAdapterClass: () => Promise.resolve(Gff3Adapter),
      }),
  )
  pluginManager.createPluggableElements()
  pluginManager.configure()

  // the gene a display drew over the window, read whole as a click on it is
  const clickedGene = async (refName: string, start: number, end: number) => {
    const region = { assemblyName: 'p', refName, start, end }
    const drawn = await firstValueFrom(
      adapters.Gff3Adapter().getFeatures(region).pipe(toArray()),
    )
    const { feature } = await new GetBasicFeatureDetails(pluginManager).execute(
      {
        sessionId: 'test',
        adapterConfig: {
          type: 'Gff3Adapter',
          gffLocation: {
            localPath: require.resolve('./test_data/origin_spanning.gff3'),
          },
        },
        featureId: drawn.find(f => f.get('type') === 'gene')!.id(),
        region,
      },
    )
    return feature!
  }

  test('a feature across the origin its file declares circular wraps there, and so does its exon past it', async () => {
    const gene = await clickedGene('pTest', 0, 50)
    const exons = gene.subfeatures![0]!.subfeatures!
    expect([gene.start, gene.end]).toEqual([949, 1150])
    expect(originCrossingLength(undefined, gene)).toBe(1000)
    expect(exons.map(exon => originCrossingLength(undefined, exon))).toEqual([
      undefined,
      1000,
    ])
  })

  test('a feature ending past a sequence its file does not declare circular is read as written', async () => {
    const gene = await clickedGene('pLinear', 940, 1000)
    expect([gene.start, gene.end]).toEqual([949, 1100])
    expect(originCrossingLength(undefined, gene)).toBeUndefined()
  })

  test('a mark display opens the piece of a feature it drew past the origin as the whole feature, wrapping there', async () => {
    const request = {
      sessionId: 'test',
      adapterConfig: {
        type: 'Gff3Adapter',
        gffLocation: {
          localPath: require.resolve('./test_data/origin_spanning.gff3'),
        },
      },
      region: { assemblyName: 'p', refName: 'pTest', start: 0, end: 50 },
      layers: [{ encoding: {}, lanes: [] }],
      layer: 0,
    }
    const [region, dloop, gene, past] = await Promise.all(
      [0, 1, 2, 3].map(featureIndex =>
        new CoreGetEncodedFeature(pluginManager).execute({
          ...request,
          featureIndex,
        }),
      ),
    )
    expect([region, dloop, gene].map(f => [f!.type, f!.start, f!.end])).toEqual(
      [
        ['region', 0, 1000],
        ['D_loop', 899, 1100],
        ['gene', 949, 1150],
      ],
    )
    expect(past).toBeUndefined()
    expect(originCrossingLength(undefined, gene!)).toBe(1000)
    expect(originCrossingLength(undefined, region!)).toBeUndefined()
  })
})
