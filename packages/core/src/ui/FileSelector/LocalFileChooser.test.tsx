import '@testing-library/jest-dom'
import { act, render } from '@testing-library/react'

import LocalFileChooser from './LocalFileChooser.tsx'
import { clearFileFromCache, setFileInCache } from '../../util/tracks.ts'

import type { FileHandleLocation } from '../../util/types/index.ts'

// A FileHandleLocation can only be opened once its File is restored into the
// in-memory cache (async, on session attach). The chooser must reactively drop
// its "(need to reload)" notice the moment that restore populates the cache,
// even though the cache read is for a handleId that is initially absent.
test('reactively clears "need to reload" once the file handle cache populates', () => {
  const handleId = 'test-reactive-handle'
  clearFileFromCache(handleId)
  const location: FileHandleLocation = {
    locationType: 'FileHandleLocation',
    name: 'reads.bam',
    handleId,
  }

  const { queryByText } = render(
    <LocalFileChooser location={location} setLocation={() => {}} />,
  )
  expect(queryByText('(need to reload)')).toBeInTheDocument()

  act(() => {
    setFileInCache(handleId, new File(['x'], 'reads.bam'))
  })
  expect(queryByText('(need to reload)')).not.toBeInTheDocument()

  clearFileFromCache(handleId)
})
