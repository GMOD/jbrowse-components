import { flipCigar } from './cigarReorient.ts'
import { csToCigar } from './csToCigar.ts'

describe('csToCigar', () => {
  test('short form match run', () => {
    expect(csToCigar(':6')).toBe('6=')
  })
  test('short form match/sub/ins/del', () => {
    expect(csToCigar(':6*ct:4+gtc:3-a')).toBe('6=1X4=3I3=1D')
  })
  test('coalesces adjacent substitutions', () => {
    expect(csToCigar(':2*ct*ga:2')).toBe('2=2X2=')
  })
  test('long form (=SEQ) match runs', () => {
    expect(csToCigar('=ACGT*ct=AC')).toBe('4=1X2=')
  })
  test('splice/intron (~) becomes N', () => {
    expect(csToCigar(':5~gt10ag:5')).toBe('5=10N5=')
  })
  test('result reorients with flipCigar', () => {
    expect(flipCigar(csToCigar(':6+gtc:3'))).toBe('3=3D6=')
  })
})
