import { fetchHub, hubUrl } from './fetchHub.ts'

describe('hubUrl', () => {
  it('maps a UCSC database name to /ucsc/<db>/', () => {
    expect(hubUrl('hg38')).toBe('https://jbrowse.org/ucsc/hg38/config.json')
  })
  it('fans a GenArk accession out into a 3-level tree', () => {
    expect(hubUrl('GCF_000001405.40')).toBe(
      'https://jbrowse.org/hubs/genark/GCF/000/001/405/GCF_000001405.40/config.json',
    )
  })
})

describe('fetchHub', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('stamps baseUri onto every uri-bearing node', async () => {
    const config = {
      assemblies: [
        { name: 'hg38', sequence: { adapter: { uri: 'seq.2bit' } } },
      ],
    }
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(config), { status: 200 }))

    const out = await fetchHub('hg38')
    const url = 'https://jbrowse.org/ucsc/hg38/config.json'
    expect(out.assemblies?.[0]).toMatchObject({
      sequence: { adapter: { uri: 'seq.2bit', baseUri: url } },
    })
  })

  it('leaves an existing baseUri untouched', async () => {
    const config = {
      assemblies: [{ sequence: { adapter: { uri: 's', baseUri: 'kept' } } }],
    }
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(config), { status: 200 }))

    const out = await fetchHub('hg38')
    const adapter = (out.assemblies?.[0] as { sequence: { adapter: unknown } })
      .sequence.adapter
    expect(adapter).toMatchObject({ baseUri: 'kept' })
  })

  it('throws a helpful error on a non-ok response', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('nope', { status: 404 }))

    await expect(fetchHub('nonexistent')).rejects.toThrow(
      /hub "nonexistent" not found \(404/,
    )
  })
})
