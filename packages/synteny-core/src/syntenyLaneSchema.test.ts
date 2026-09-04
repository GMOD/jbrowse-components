import { UNNAMED } from './stringDict.ts'
import {
  SYNTENY_LANES,
  canonicalizeSyntenyDictLanes,
  packSyntenyLanes,
  syntenyLaneFields,
} from './syntenyLaneSchema.ts'

interface Row {
  id: string
  name?: string
  refName: string
  asm: string
  mateRefName: string
  mateAsm: string
  start: number
  end: number
  mateStart: number
  mateEnd: number
  strand: number
}

function pack(rows: Row[]) {
  return packSyntenyLanes(rows, {
    numeric: {
      strands: r => r.strand,
      starts: r => r.start,
      ends: r => r.end,
      mateStarts: r => r.mateStart,
      mateEnds: r => r.mateEnd,
    },
    dict: {
      name: r => r.name,
      refName: r => r.refName,
      assemblyName: r => r.asm,
      mateRefName: r => r.mateRefName,
      mateAssemblyName: r => r.mateAsm,
    },
    list: {
      featureIds: r => r.id,
    },
  })
}

const rows: Row[] = [
  {
    id: 'a',
    name: 'genA',
    refName: 'chr1',
    asm: 'asm1',
    mateRefName: 'x',
    mateAsm: 'asm2',
    start: 10,
    end: 20,
    mateStart: 30,
    mateEnd: 40,
    strand: -1,
  },
  {
    id: 'b',
    refName: 'chr2',
    asm: 'asm1',
    mateRefName: 'x',
    mateAsm: 'asm2',
    start: 50,
    end: 60,
    mateStart: 70,
    mateEnd: 80,
    strand: 1,
  },
]

test('packs each lane with first-seen dictionary interning', () => {
  const data = pack(rows)
  expect(data.strands).toEqual(Int8Array.from([-1, 1]))
  expect(data.starts).toEqual(Uint32Array.from([10, 50]))
  expect(data.ends).toEqual(Uint32Array.from([20, 60]))
  expect(data.mateStarts).toEqual(Uint32Array.from([30, 70]))
  expect(data.mateEnds).toEqual(Uint32Array.from([40, 80]))
  expect(data.featureIds).toEqual(['a', 'b'])
  expect(data.refNameDict).toEqual(['chr1', 'chr2'])
  expect([...data.refNameIds]).toEqual([0, 1])
  expect(data.assemblyNameDict).toEqual(['asm1'])
  expect([...data.assemblyNameIds]).toEqual([0, 0])
  expect(data.mateRefNameDict).toEqual(['x'])
  expect(data.mateAssemblyNameDict).toEqual(['asm2'])
})

test("a record without a value gets the lane's sentinel", () => {
  const data = pack(rows)
  expect(data.nameDict[data.nameIds[0]!]).toBe('genA')
  expect(data.nameDict[data.nameIds[1]!]).toBe(UNNAMED)
})

test('a sentinel-less lane refuses a missing value, naming the lane', () => {
  const bad = [{ ...rows[0]!, refName: undefined as unknown as string }]
  expect(() => pack(bad)).toThrow('lane refName')
})

test('canonicalize routes each renamed lane through its own resolver and touches nothing else', () => {
  const data = pack(rows)
  const out = canonicalizeSyntenyDictLanes(
    { ...data, extra: 'kept' },
    {
      query: n => `Q_${n}`,
      target: n => `T_${n}`,
      assembly: n => `A_${n}`,
    },
  )
  expect(out.refNameDict).toEqual(['Q_chr1', 'Q_chr2'])
  expect(out.mateRefNameDict).toEqual(['T_x'])
  expect(out.mateAssemblyNameDict).toEqual(['A_asm2'])
  expect(out.nameDict).toEqual(data.nameDict)
  expect(out.assemblyNameDict).toEqual(data.assemblyNameDict)
  expect(out.starts).toBe(data.starts)
  expect(out.extra).toBe('kept')
})

test('canonicalize collapses aliased spellings and rewrites the ids', () => {
  const data = pack([rows[0]!, { ...rows[1]!, refName: '1' }])
  const out = canonicalizeSyntenyDictLanes(data, {
    query: n => (n === '1' ? 'chr1' : n),
    target: n => n,
    assembly: n => n,
  })
  expect(out.refNameDict).toEqual(['chr1'])
  expect([...out.refNameIds]).toEqual([0, 0])
})

test('every dict lane names its payload field pair', () => {
  const dictFields = SYNTENY_LANES.filter(
    l => l.kind === 'string-dict',
  ).flatMap(syntenyLaneFields)
  expect(dictFields).toEqual([
    'nameDict',
    'nameIds',
    'refNameDict',
    'refNameIds',
    'assemblyNameDict',
    'assemblyNameIds',
    'mateRefNameDict',
    'mateRefNameIds',
    'mateAssemblyNameDict',
    'mateAssemblyNameIds',
  ])
})
