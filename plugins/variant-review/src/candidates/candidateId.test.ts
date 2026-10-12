import { candidateId, dedupeCandidateIds } from './candidateId.ts'

const base = {
  assemblyName: 'volvox',
  refName: 'ctgA',
  pos1: 101,
  ref: 'G',
  alts: ['A'],
  end0: 101,
}

test('non-symbolic ids have no END', () => {
  expect(candidateId(base)).toBe('volvox:ctgA:101:G:A')
})

test('ids are stable and case-folded', () => {
  expect(candidateId({ ...base, ref: 'g', alts: ['a', 'TT'] })).toBe(
    'volvox:ctgA:101:G:A,TT',
  )
  expect(candidateId({ ...base, ref: 'g', alts: ['a', 'TT'] })).toBe(
    candidateId({ ...base, ref: 'G', alts: ['A', 'tt'] }),
  )
})

test('symbolic ids carry END so two <DEL>s at one POS differ', () => {
  const a = candidateId({ ...base, alts: ['<DEL>'], end0: 500 })
  const b = candidateId({ ...base, alts: ['<DEL>'], end0: 900 })
  expect(a).toBe('volvox:ctgA:101:G:<DEL>:500')
  expect(a).not.toBe(b)
})

test('true duplicates are suffixed in order', () => {
  const records = [{ id: 'x' }, { id: 'y' }, { id: 'x' }, { id: 'x' }]
  expect(dedupeCandidateIds(records)).toBe(2)
  expect(records.map(r => r.id)).toEqual(['x', 'y', 'x#2', 'x#3'])
})
