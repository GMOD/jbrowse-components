import { promises as fsPromises } from 'fs'
import path from 'path'

import { removeBedHeaders } from './BedImport'

test('bed header trimming', async () => {
  const filepath = path.join(__dirname, '..', 'test_data', 'foo.bed')
  const buf = await fsPromises.readFile(filepath)
  expect(buf[0]).toEqual(98)
  expect(buf[1]).toEqual(114)
  const trimmedBuffer = removeBedHeaders(buf)
  expect(trimmedBuffer[0]).toEqual(99)
  expect(trimmedBuffer.length).toBe(275)
})
