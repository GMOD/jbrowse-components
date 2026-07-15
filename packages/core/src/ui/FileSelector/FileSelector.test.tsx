import '@testing-library/jest-dom'
import { useState } from 'react'

import { fireEvent, render } from '@testing-library/react'

import FileSelector from './FileSelector.tsx'

import type { BaseInternetAccountModel } from '../../pluggableElementTypes/index.ts'
import type { AbstractRootModel, FileLocation } from '../../util/types/index.ts'

const account = {
  internetAccountId: 'dropbox',
  type: 'DropboxInternetAccount',
  name: 'DBX',
} as BaseInternetAccountModel

const rootModel = {
  findAppropriateInternetAccount: () => undefined,
  internetAccounts: [account],
} as unknown as AbstractRootModel

function Harness({ onChange }: { onChange: (loc: FileLocation) => void }) {
  const [location, setLocation] = useState<FileLocation>()
  return (
    <FileSelector
      rootModel={rootModel}
      location={location}
      setLocation={loc => {
        onChange(loc)
        setLocation(loc)
      }}
    />
  )
}

// Selecting an account toggle after a URL is already typed must stamp the
// account's internetAccountId onto the location. This used to be driven by a
// useEffect; it now lives in the source-type change handler, which reads the
// new account from accountMap rather than the pre-change selected account.
test('stamps internetAccountId when an account is selected after typing a URL', () => {
  const onChange = jest.fn()
  const { getByTestId, getByRole } = render(<Harness onChange={onChange} />)

  fireEvent.change(getByTestId('urlInput'), {
    target: { value: 'https://example.com/f.bam' },
  })
  expect(onChange).toHaveBeenLastCalledWith({
    uri: 'https://example.com/f.bam',
    locationType: 'UriLocation',
  })

  fireEvent.click(getByRole('button', { name: 'DBX' }))
  expect(onChange).toHaveBeenLastCalledWith({
    uri: 'https://example.com/f.bam',
    locationType: 'UriLocation',
    internetAccountId: 'dropbox',
  })
})
