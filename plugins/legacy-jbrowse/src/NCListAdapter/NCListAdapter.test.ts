import path from 'node:path'

import { LocalFile } from 'generic-filehandle2'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter from './NCListAdapter.ts'
import configSchema from './configSchema.ts'

import type { GenericFilehandle } from 'generic-filehandle2'

type Node = Record<string, unknown> & { subfeatures?: Node[] }

function generateReadBuffer(
  getFileFunction: (str: string) => GenericFilehandle,
) {
  return (request: Request) => {
    const file = getFileFunction(request.url)
    return file.readFile('utf8')
  }
}

const walk = (nodes: Node[]): Node[] =>
  nodes.flatMap(n => [n, ...walk(n.subfeatures ?? [])])

const depth = (n: Node): number =>
  1 + Math.max(0, ...(n.subfeatures ?? []).map(depth))

// One line per feature: every coordinate, type, strand, name and child count in
// the set. A parse that moves a base, drops a transcript or renames a type fails
// here, which is what the 94 per-feature snapshots this replaced were for.
const summarize = (n: Node) =>
  [
    n.type,
    `${n.refName}:${n.start}-${n.end}`,
    `strand=${n.strand}`,
    n.name ?? n.id ?? '-',
    `children=${(n.subfeatures ?? []).length}`,
  ].join(' ')

// Field-level cover for the nodes no spot check reaches. Low-cardinality fields
// list their values, so a changed `source` or `phase` anywhere in the tree fails;
// high-cardinality ones (ids, coordinates) would only restate the summary above,
// so they carry a count instead.
function fieldCensus(nodes: Node[]) {
  const acc = new Map<string, string[]>()
  for (const node of nodes) {
    for (const [k, v] of Object.entries(node)) {
      if (k === 'subfeatures') {
        continue
      }
      acc.set(k, [...(acc.get(k) ?? []), JSON.stringify(v)])
    }
  }
  return Object.fromEntries(
    [...acc.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, vals]) => {
        const distinct = [...new Set(vals)].sort()
        return [
          k,
          distinct.length <= 12
            ? `${vals.length}x ${distinct.join(' ')}`
            : `${vals.length}x, ${distinct.length} distinct`,
        ]
      }),
  )
}

beforeEach(() => {
  fetchMock.resetMocks()
  fetchMock.mockResponse(
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

  const featJson = featArr.map(f => f.toJSON()) as unknown as Node[]
  expect(featJson.length).toEqual(94)

  const all = walk(featJson)
  expect(all.length).toEqual(2165)
  expect(featJson.map(summarize)).toMatchSnapshot()
  expect(fieldCensus(all)).toMatchSnapshot()

  // Two features in full, so a field-value change stays diagnosable rather than
  // only counted: the first, and the smallest gene->transcript->exon tree, which
  // is the deepest nesting the format produces here.
  expect(featJson[0]).toMatchSnapshot({ uniqueId: expect.any(String) })
  const smallestDeep = featJson
    .filter(f => depth(f) === 3)
    .sort((a, b) => walk([a]).length - walk([b]).length)[0]!
  expect(smallestDeep).toMatchSnapshot({ uniqueId: expect.any(String) })

  expect(await adapter.hasDataForRefName('ctgA')).toBe(false)
  expect(await adapter.hasDataForRefName('21')).toBe(true)
  expect(await adapter.hasDataForRefName('20')).toBe(false)
})
