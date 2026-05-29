/**
 * @jest-environment node
 */

import { parsePort } from './utils.ts'

test('defaults when no port string is given', () => {
  expect(parsePort({ portStr: undefined })).toBe(9090)
  expect(parsePort({ portStr: undefined, defaultPort: 8080 })).toBe(8080)
})

test('parses a valid port', () => {
  expect(parsePort({ portStr: '3000' })).toBe(3000)
})

test('accepts the boundary ports 1 and 65535', () => {
  expect(parsePort({ portStr: '1' })).toBe(1)
  expect(parsePort({ portStr: '65535' })).toBe(65535)
})

test('rejects out-of-range ports', () => {
  expect(() => parsePort({ portStr: '0' })).toThrow(/not a valid port/)
  expect(() => parsePort({ portStr: '65536' })).toThrow(/not a valid port/)
  expect(() => parsePort({ portStr: '-10' })).toThrow(/not a valid port/)
})
