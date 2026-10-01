import { setFileInCache } from '../tracks.ts'
import { openLocation } from './index.ts'

const text = async (handleId: string) =>
  new TextDecoder().decode(
    await openLocation({
      handleId,
      name: 'reads.txt',
      locationType: 'FileHandleLocation',
    }).read(10, 0),
  )

test('a file re-read from disk under the same handle serves its new bytes', async () => {
  setFileInCache(
    'h1',
    new File(['AAAAAAAAAA'], 'reads.txt', { lastModified: 1 }),
  )
  expect(await text('h1')).toBe('AAAAAAAAAA')

  setFileInCache(
    'h1',
    new File(['BBBBBBBBBB'], 'reads.txt', { lastModified: 2 }),
  )
  expect(await text('h1')).toBe('BBBBBBBBBB')
})
