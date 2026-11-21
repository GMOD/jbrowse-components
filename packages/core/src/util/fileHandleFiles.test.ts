import {
  fileHandleBlobId,
  getFileFromCache,
  refreshFileHandleFiles,
  setFileInCache,
} from './fileHandleFiles.ts'

function handleYielding(getFile: () => Promise<File>) {
  return { getFile } as unknown as FileSystemFileHandle
}

test('a file edited on disk is read again when the page asks its handle', async () => {
  let onDisk = new File(['AAAA'], 'a.bed', { lastModified: 1 })
  setFileInCache(
    'edited',
    onDisk,
    handleYielding(async () => onDisk),
  )
  const before = fileHandleBlobId('edited')

  onDisk = new File(['BBBBBB'], 'a.bed', { lastModified: 2 })
  await refreshFileHandleFiles()

  expect(getFileFromCache('edited')).toBe(onDisk)
  expect(fileHandleBlobId('edited')).not.toBe(before)
})

test('an unchanged file keeps its snapshot', async () => {
  const held = new File(['AAAA'], 'a.bed', { lastModified: 1 })
  setFileInCache(
    'unchanged',
    held,
    handleYielding(
      async () => new File(['AAAA'], 'a.bed', { lastModified: 1 }),
    ),
  )
  await refreshFileHandleFiles()
  expect(getFileFromCache('unchanged')).toBe(held)
})

test('a file the handle can no longer read leaves the cache', async () => {
  setFileInCache(
    'revoked',
    new File(['AAAA'], 'a.bed'),
    handleYielding(() => Promise.reject(new Error('NotAllowedError'))),
  )
  await refreshFileHandleFiles()
  expect(getFileFromCache('revoked')).toBeUndefined()
})
