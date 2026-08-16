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
  showInFileSelector: true,
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

// The mirror of the above, and the half that was missing: leaving an account
// has to take its stamp with it, or the file keeps being fetched through an
// account the form no longer shows as selected
test('unstamps internetAccountId when the source type goes back to URL', () => {
  const onChange = jest.fn()
  const { getByTestId, getByRole } = render(<Harness onChange={onChange} />)

  fireEvent.change(getByTestId('urlInput'), {
    target: { value: 'https://example.com/f.bam' },
  })
  fireEvent.click(getByRole('button', { name: 'DBX' }))
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ internetAccountId: 'dropbox' }),
  )

  fireEvent.click(getByRole('button', { name: 'url' }))
  expect(onChange).toHaveBeenLastCalledWith({
    uri: 'https://example.com/f.bam',
    locationType: 'UriLocation',
  })
})

// Every branch of this control names its own input the same way — "Enter URL",
// or a Choose File button — so with no name on the pair, a form of five
// selectors reads out as five identical fields.
test('the toggle and input are one group carrying the field name', () => {
  const { getByRole } = render(
    <FileSelector
      name="FASTA index (.fai) file"
      description="Sits beside the FASTA."
      location={{ uri: '', locationType: 'UriLocation' }}
      setLocation={() => {}}
    />,
  )

  const group = getByRole('group', { name: 'FASTA index (.fai) file' })
  expect(group).toHaveAccessibleDescription('Sits beside the FASTA.')
  expect(group).toContainElement(getByRole('button', { name: 'url' }))
})

test('an unnamed selector claims no name rather than an empty one', () => {
  const { getAllByRole } = render(
    <FileSelector
      location={{ uri: '', locationType: 'UriLocation' }}
      setLocation={() => {}}
    />,
  )

  // the outer group is this control's; the inner one is the toggle's own
  const [group] = getAllByRole('group')
  expect(group).not.toHaveAttribute('aria-labelledby')
  expect(group).not.toHaveAttribute('aria-describedby')
})
