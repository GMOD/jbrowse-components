import path from 'path'

import { LocalFile } from 'generic-filehandle2'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'
import { beforeEach, expect, test, vi } from 'vitest'

import Adapter from './NCListAdapter'
import configSchema from './configSchema'

import type { GenericFilehandle } from 'generic-filehandle2'

function generateReadBuffer(
  getFileFunction: (str: string) => GenericFilehandle,
) {
  return (request: string) => ({
    arrayBuffer: () => getFileFunction(request).readFile('utf8'),
    status: 200,
    ok: true,
  })
}

beforeEach(() => {
  global.fetch = vi
    .fn()
    .mockImplementation(
      generateReadBuffer(
        (url: string) =>
          new LocalFile(path.join(__dirname, `../../test_data/${url}`)),
      ),
    )
})

test('adapter can fetch features from ensembl_genes test set', async () => {
  const args = {
    refNames: [],
    rootUrlTemplate: {
      uri: 'ensembl_genes/{refseq}/trackData.json',
      locationType: 'UriLocation',
    },
  }
  const adapter = new Adapter(configSchema.create(args))

  const features = adapter.getFeatures({
    assemblyName: 'volvox',
    refName: '21',
    start: 34960388,
    end: 35960388,
  })

  const featArr = await firstValueFrom(features.pipe(toArray()))
  expect(featArr[0]!.get('refName')).toBe('21')
  const featJson = featArr.map(f => f.toJSON())
  expect(featJson.length).toEqual(94)
  for (const feature of featJson) {
    expect(feature).toMatchSnapshot({ uniqueId: expect.any(String) })
  }

  expect(await adapter.hasDataForRefName('ctgA')).toBe(false)
  expect(await adapter.hasDataForRefName('21')).toBe(true)
  expect(await adapter.hasDataForRefName('20')).toBe(false)
})
