import {
  isAbnormalPairDirection,
  pairDirection,
  splitInversion,
} from './orientation.ts'

test('pairDirection maps FR-library orientation strings', () => {
  expect(pairDirection('F1R2')).toBe('LR')
  expect(pairDirection('F2R1')).toBe('LR')
  expect(pairDirection('R1F2')).toBe('RL')
  expect(pairDirection('R1R2')).toBe('RR')
  expect(pairDirection('F1F2')).toBe('LL')
  expect(pairDirection(undefined)).toBeUndefined()
  expect(pairDirection('bogus')).toBeUndefined()
})

test('isAbnormalPairDirection: only LR is normal', () => {
  expect(isAbnormalPairDirection('LR')).toBe(false)
  expect(isAbnormalPairDirection('RL')).toBe(true)
  expect(isAbnormalPairDirection('RR')).toBe(true)
  expect(isAbnormalPairDirection('LL')).toBe(true)
  expect(isAbnormalPairDirection(undefined)).toBe(false)
})

test('splitInversion classifies strand-flip flavor', () => {
  expect(splitInversion(-1, 1)).toBe('rf')
  expect(splitInversion(1, -1)).toBe('fr')
  expect(splitInversion(1, 1)).toBeUndefined()
  expect(splitInversion(-1, -1)).toBeUndefined()
})
