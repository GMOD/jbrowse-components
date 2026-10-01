import { formatBytes } from './formatBytes.ts'

test('bytes stay whole and every step above gets one decimal', () => {
  expect(formatBytes(0)).toBe('0 bytes')
  expect(formatBytes(999)).toBe('999 bytes')
  expect(formatBytes(1000)).toBe('1.0 kB')
  expect(formatBytes(20000)).toBe('20.0 kB')
  expect(formatBytes(1_500_000)).toBe('1.5 MB')
  expect(formatBytes(2_000_000_000)).toBe('2.0 GB')
})

// SI, so the step is 1000 and not 1024 — the copy this replaced divided by 1024
// and still called the result "KB"
test('a kB is 1000 bytes', () => {
  expect(formatBytes(1024)).toBe('1.0 kB')
})

// the largest unit absorbs everything past it rather than running off the table
test('a value past the last unit stays in it', () => {
  expect(formatBytes(5e15)).toBe('5000.0 TB')
})

test('a value that rounds up to 1000 advances the unit', () => {
  expect(formatBytes(999_949)).toBe('999.9 kB')
  expect(formatBytes(999_950)).toBe('1.0 MB')
  expect(formatBytes(999_999)).toBe('1.0 MB')
  expect(formatBytes(999_950_000)).toBe('1.0 GB')
})
