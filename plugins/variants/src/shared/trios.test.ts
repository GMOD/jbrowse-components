import { triosOf } from './trios.ts'

const PARENTS = [{ name: 'dad' }, { name: 'mom' }]

function childSexUnder(sex: string) {
  return triosOf([{ name: 'kid', father: 'dad', sex }, ...PARENTS])[0]?.sex
}

test('a samples table’s sex column reads as the pedigree’s codes do', () => {
  expect(['1', 'M', 'm', 'Male', 'MALE'].map(childSexUnder)).toEqual([
    'male',
    'male',
    'male',
    'male',
    'male',
  ])
  expect(['2', 'F', 'f', 'Female'].map(childSexUnder)).toEqual([
    'female',
    'female',
    'female',
    'female',
  ])
  expect(['other', 'hermaphrodite'].map(childSexUnder)).toEqual([
    'other',
    'other',
  ])
})

test('a missing sex is no sex, so the check weighs both readings', () => {
  expect(['', '0', '-9', 'NA', 'unknown'].map(childSexUnder)).toEqual([
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
  ])
})
