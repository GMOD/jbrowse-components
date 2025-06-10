import path from 'path'

import { LocalFile } from 'generic-filehandle2'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'
import { beforeEach, expect, test, vi } from 'vitest'

import Adapter from './NCListAdapter'
import configSchema from './configSchema'

beforeEach(() => {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    return Promise.resolve({
      arrayBuffer: async () => {
        console.log('HERE')
        const f = new LocalFile(
          path.join(__dirname, `../../test_data/volvox/${url}`),
        )
        const ret = await f.readFile()
        console.log('does not get here')
        return ret
      },
      json: () => {
        return new LocalFile(
          path.join(__dirname, `../../test_data/volvox/${url}`),
        )
          .readFile('utf8')
          .then(text => JSON.parse(text))
      },
      text: () => {
        return new LocalFile(
          path.join(__dirname, `../../test_data/volvox/${url}`),
        ).readFile('utf8')
      },
      status: 200,
      ok: true,
      headers: new Map(),
    })
  })
})

// test('adapter can fetch features from ensembl_genes test set', async () => {
//   const adapter = new Adapter(
//     configSchema.create({
//       refNames: [],
//       rootUrlTemplate: {
//         uri: 'http://site.com/volvox_genes_nclist/{refseq}/trackData.json',
//         locationType: 'UriLocation',
//       },
//     }),
//   )
//
//   const features = adapter.getFeatures({
//     assemblyName: 'volvox',
//     refName: 'ctgA',
//     start: 0,
//     end: 50000,
//   })
//
//   const featArr = await firstValueFrom(features.pipe(toArray()))
//   console.log({ featArr })
//   expect(featArr[0]!.get('refName')).toBe('ctgA')
//   const featJson = featArr.map(f => f.toJSON())
//   expect(featJson.length).toEqual(94)
//   for (const feature of featJson) {
//     expect(feature).toMatchSnapshot({ uniqueId: expect.any(String) })
//   }
//
//   expect(await adapter.hasDataForRefName('ctgA')).toBe(false)
//   expect(await adapter.hasDataForRefName('21')).toBe(true)
//   expect(await adapter.hasDataForRefName('20')).toBe(false)
// })
