import {
  adapterRefName,
  adapterRefNameText,
  canonicalAdapterRefName,
} from './adapterRefName.ts'

const assembly = {
  getCanonicalRefName2: (refName: string) =>
    refName === 'chr1' ? '1' : refName,
}

test('canonicalizes through the assembly', () => {
  expect(canonicalAdapterRefName(assembly, adapterRefName('chr1'))).toBe('1')
})

test("keeps the file's spelling without an assembly", () => {
  expect(canonicalAdapterRefName(undefined, adapterRefName('chr1'))).toBe(
    'chr1',
  )
})

test('is the plain string at runtime', () => {
  expect(adapterRefNameText(adapterRefName('chr1'))).toBe('chr1')
})

test('cannot meet a canonical name unconverted', () => {
  const mate = adapterRefName('chr1')
  const viewRefName: string = '1'
  const byRefName = new Map<string, number>()
  const lengths: Record<string, number> = {}
  // @ts-expect-error TS2367: one end branded is enough
  expect(mate === viewRefName).toBe(false)
  // @ts-expect-error TS2345
  expect(byRefName.get(mate)).toBeUndefined()
  // @ts-expect-error TS2538
  expect(lengths[mate]).toBeUndefined()
})
