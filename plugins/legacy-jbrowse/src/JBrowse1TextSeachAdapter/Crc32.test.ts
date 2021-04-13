/**
 * Implementation of JB2 crc32 is based on JBrowse1 implementation
 * found here:
 * https://github.com/GMOD/jbrowse/blob/b8324df0033796b6d502696dc65c9ff888aae2f3/src/JBrowse/Digest/Crc32.js
 * Used converter online to verify results:
 * https://crccalc.com/
 */
import { crc32, stringToBytes } from './Crc32'

describe('test JBrowse1 crc32 implementation', () => {
  test('test string to bytes', () => {
    // Note: utf8 string is turned into a decimal byte array
    expect(stringToBytes('apple')).toEqual([97, 112, 112, 108, 101])
    expect(stringToBytes('foo')).toEqual([102, 111, 111])
  })
  test('test crc32', () => {
    // input: string, output: dec
    expect(crc32('apple')).toBe(2838417488)
    expect(crc32('foo')).toBe(2356372769)
  })
})
