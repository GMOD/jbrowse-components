import { getConf } from '@gmod/jbrowse-core/configuration'
import { createTestEnv } from '../JBrowse'

describe('Assembly Manager', () => {
  let session
  let assemblyManager

  beforeAll(async () => {
    ;({ session } = await createTestEnv({
      assemblies: [
        {
          assemblyName: 'volvox',
          sequence: {
            type: 'ReferenceSequenceTrack',
            adapter: {
              type: 'FromConfigAdapter',
              features: [],
            },
          },
          aliases: ['vvx'],
          refNameAliases: {
            adapter: {
              type: 'FromConfigAdapter',
              features: [
                {
                  refName: 'ctgA',
                  uniqueId: 'alias1',
                  aliases: ['A', 'contigA'],
                },
                {
                  refName: 'ctgB',
                  uniqueId: 'alias2',
                  aliases: ['B', 'contigB'],
                },
              ],
            },
          },
          tracks: [
            {
              type: 'FilteringTrack',
              name: 'Filter Test',
              adapter: {
                configId: 'testingId',
                type: 'FromConfigAdapter',
                features: [
                  {
                    uniqueId: 'one',
                    refName: 'contigA',
                    start: 100,
                    end: 101,
                    type: 'foo',
                    name: 'Boris',
                    note: 'note for boris',
                  },
                  {
                    uniqueId: 'two',
                    refName: 'contigA',
                    start: 110,
                    end: 111,
                    type: 'bar',
                    name: 'Theresa',
                    note: 'note for theresa',
                  },
                  {
                    uniqueId: 'three',
                    refName: 'contigA',
                    start: 120,
                    end: 121,
                    type: 'baz',
                    name: 'Nigel',
                    note: 'note for nigel',
                  },
                  {
                    uniqueId: 'four',
                    refName: 'contigA',
                    start: 130,
                    end: 131,
                    type: 'quux',
                    name: 'Geoffray',
                    note: 'note for geoffray',
                  },
                ],
              },
              renderer: {
                type: 'SvgFeatureRenderer',
                labels: {},
              },
              filterAttributes: ['type', 'start', 'end'],
            },
          ],
        },
      ],
    }))
    ;({ assemblyManager } = session)
  })

  it('gets ref name aliases', async () => {
    const refNameAliases = {
      ctgA: ['A', 'contigA'],
      ctgB: ['B', 'contigB'],
    }
    expect(await assemblyManager.getRefNameAliases('volvox')).toEqual(
      refNameAliases,
    )
    expect(await assemblyManager.getRefNameAliases('vvx')).toEqual(
      refNameAliases,
    )
  })

  it('aliases ref names for a track', async () => {
    session.addLinearGenomeViewOfAssembly('volvox', {})
    session.views[0].showTrack(session.configuration.assemblies[0].tracks[0])

    assemblyManager.clear()
    expect(assemblyManager.refNameMaps).toMatchInlineSnapshot(`Map {}`)
    const adapter = getConf(session.views[0].tracks[0], 'adapter')
    await assemblyManager.addRefNameMapForAdapter(adapter, 'volvox')

    expect(assemblyManager.refNameMaps).toMatchInlineSnapshot(`
      Map {
        "testingId" => Map {
          "ctgA" => "contigA",
          "A" => "contigA",
        },
      }
    `)
  })
})
