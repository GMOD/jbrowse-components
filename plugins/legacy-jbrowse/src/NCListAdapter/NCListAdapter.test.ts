import path from 'path'
import { LocalFile } from 'generic-filehandle'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'
import Adapter from './NCListAdapter'
import configSchema from './configSchema'
import type { GenericFilehandle } from 'generic-filehandle'

function generateReadBuffer(
  getFileFunction: (str: string) => GenericFilehandle,
) {
  return (request: Request) => {
    const file = getFileFunction(request.url)
    return file.readFile('utf8')
  }
}

beforeEach(() => {
  // @ts-expect-error
  fetch.resetMocks()
  // @ts-expect-error
  fetch.mockResponse(
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
  expect(featArr[0]!.id()).toBe('test-21,0,0,19,22,0')
  const featJson = featArr.map(f => f.toJSON())
  expect(featJson.length).toEqual(94)
  for (const feature of featJson) {
    expect(feature).toMatchSnapshot({ uniqueId: expect.any(String) })
  }

  expect(await adapter.hasDataForRefName('ctgA')).toBe(false)
  expect(await adapter.hasDataForRefName('21')).toBe(true)
  expect(await adapter.hasDataForRefName('20')).toBe(false)
})
