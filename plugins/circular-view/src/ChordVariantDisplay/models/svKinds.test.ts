import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { CircularViewModel } from '../../CircularView/model.ts'
import type { Feature } from '@jbrowse/core/util'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

async function svKindsDisplay() {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volvox',
    sequence: {
      trackId: 'volvox_refseq',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'ctgA',
            start: 0,
            end: 16000,
            seq: 'a'.repeat(16000),
          },
          {
            refName: 'ctgB',
            uniqueId: 'ctgB',
            start: 0,
            end: 8000,
            seq: 'a'.repeat(8000),
          },
        ],
      },
    },
  })
  session.addSessionTrackConf({
    trackId: 'sv',
    type: 'VariantTrack',
    name: 'sv kinds',
    assemblyNames: ['volvox'],
    adapter: {
      type: 'VcfAdapter',
      vcfLocation: {
        localPath: require.resolve('../test_data/sv_kinds.vcf'),
        locationType: 'LocalPathLocation',
      },
    },
  })
  const view = (await session.launchView('CircularView', {
    assembly: 'volvox',
    tracks: ['sv'],
  })) as CircularViewModel
  view.setWidth(800)
  await session.assemblyManager.waitForAssembly('volvox')
  await when(() => view.tracks.length > 0)
  const display = view.tracks[0]!.displays[0]! as {
    ready: boolean
    features: Feature[]
    chordFeet: { junction: string[]; placed: Uint8Array }
    chordLanes: { features: Feature[] }
    laneIndexById: Map<string, number>
  }
  await when(() => display.ready)
  return display
}

// One record of each kind an SV caller writes, read through the VCF adapter:
// each chord runs between the two loci the record names, a breakend pair's
// two records drawing one chord, and a record naming one locus a chord of no
// length. Ends are 0-based, on slices ctgA (0) and ctgB (1).
test('every SV kind draws its chord between the loci it names, a breakend pair once', async () => {
  const display = await svKindsDisplay()
  const { junction, placed } = display.chordFeet
  const ends = Object.fromEntries(
    display.features.map((f, i) => [
      String(f.get('name')),
      placed[i] ? junction[i] : undefined,
    ]),
  )
  expect(ends).toEqual({
    bnd_a: '0:1000|1:2000',
    bnd_b: '0:1000|1:2000',
    bnd_c: '0:3000|1:4000',
    bnd_d: '0:3500|1:4500',
    del: '0:5000|0:5999',
    del_me: '0:6500|0:6799',
    inv: '0:7000|0:7999',
    dup: '0:8500|0:8999',
    cnv: '0:9100|0:9499',
    del_svlen: '0:10000|0:10500',
    del_seq: '0:11000|0:11020',
    tra: '0:12000|1:6000',
    ins: '0:13000|0:13000',
    single: '0:14000|0:14001',
    snv: '0:15000|0:15001',
  })
  const drawn = display.chordLanes.features.map(f => f.get('name'))
  expect(drawn).toHaveLength(14)
  expect(drawn.filter(name => name === 'bnd_a' || name === 'bnd_b')).toEqual([
    'bnd_a',
  ])
  const idOf = (name: string) =>
    display.features.find(f => f.get('name') === name)!.id()
  expect(display.laneIndexById.get(idOf('bnd_b'))).toBe(
    display.laneIndexById.get(idOf('bnd_a')),
  )
}, 30000)
