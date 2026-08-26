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
  selectorLabel: 'Enter Dropbox share link',
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

// An account toggle is a URL box that stamps what you type — it has no input of
// its own, and `selectorLabel` exists to name that box. Only 'url' and 'file'
// drew anything, so picking Dropbox left a field label and a toggle group with
// nothing under them, and `selectorLabel` was unreachable.
test('an account toggle keeps the url box, labelled as that account', () => {
  const onChange = jest.fn()
  const { getByTestId, getByRole } = render(<Harness onChange={onChange} />)

  fireEvent.change(getByTestId('urlInput'), {
    target: { value: 'https://example.com/f.bam' },
  })
  fireEvent.click(getByRole('button', { name: 'DBX' }))

  expect(getByTestId('urlInput')).toHaveValue('https://example.com/f.bam')
  expect(getByRole('textbox', { name: 'Enter Dropbox share link' })).toBe(
    getByTestId('urlInput'),
  )
})

// The same hole reached from a saved config: the toggle is picked from the
// location's own stamp, so a form opening on one showed no input at all.
test('a location arriving already stamped with an account shows its url', () => {
  const { getByTestId } = render(
    <FileSelector
      rootModel={rootModel}
      location={{
        uri: 'https://example.com/f.bam',
        locationType: 'UriLocation',
        internetAccountId: 'dropbox',
      }}
      setLocation={() => {}}
    />,
  )

  expect(getByTestId('urlInput')).toHaveValue('https://example.com/f.bam')
})

// What a location asks for and what the group draws are separate answers, so a
// selection none of the buttons carries has to resolve to one that is drawn —
// otherwise the group sits with nothing pressed above whatever the unmatched id
// happened to render.
describe('a selection the toggle group does not offer', () => {
  const setUrl = (rest: string) => {
    window.history.replaceState(null, '', `${window.location.pathname}${rest}`)
  }
  afterEach(() => {
    setUrl('')
  })

  // this host does not install the authentication plugin, so nothing draws a
  // Dropbox button for the stamp to select
  test('an account this host does not have falls back to URL', () => {
    const { getByRole, getByTestId } = render(
      <FileSelector
        location={{
          uri: 'https://example.com/f.bam',
          locationType: 'UriLocation',
          internetAccountId: 'dropbox',
        }}
        setLocation={() => {}}
      />,
    )

    expect(getByRole('button', { name: 'url' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(getByTestId('urlInput')).toHaveValue('https://example.com/f.bam')
  })

  // admin mode draws no File toggle, and an untouched slot used to open on it
  // anyway — offering a local file picker whose BlobLocation the admin server
  // cannot write into config.json
  test('an empty slot in admin mode opens on URL, not the withheld File', () => {
    setUrl('?adminKey=abc')
    const { getByRole, queryByRole, getByTestId } = render(
      <FileSelector
        location={{ uri: '', locationType: 'UriLocation' }}
        setLocation={() => {}}
      />,
    )

    expect(queryByRole('button', { name: 'local file' })).toBeNull()
    expect(getByRole('button', { name: 'url' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(getByTestId('urlInput')).toBeInTheDocument()
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

// A form that fills a field in for the user has to be able to SHOW it filled
// in. The box read its location once at mount, so the add-track widget's
// detected index went into the model and left an empty box under a note saying
// it had been filled in.
test('a location set from outside shows up in the box', () => {
  const { getByTestId, rerender } = render(
    <FileSelector
      location={{
        uri: 'https://x.test/calls.vcf.gz',
        locationType: 'UriLocation',
      }}
      setLocation={() => {}}
    />,
  )
  rerender(
    <FileSelector
      location={{
        uri: 'https://x.test/calls.vcf.gz.csi',
        locationType: 'UriLocation',
      }}
      setLocation={() => {}}
    />,
  )
  expect(getByTestId('urlInput')).toHaveValue('https://x.test/calls.vcf.gz.csi')
})

// The location is trimmed and what is on screen is not, or a space typed
// mid-URL would be deleted as fast as it was typed.
test('a trailing space stays on screen and off the location', () => {
  const onChange = jest.fn()
  const { getByTestId } = render(<Harness onChange={onChange} />)

  fireEvent.change(getByTestId('urlInput'), {
    target: { value: 'https://x/f ' },
  })
  expect(onChange).toHaveBeenLastCalledWith({
    uri: 'https://x/f',
    locationType: 'UriLocation',
  })
  expect(getByTestId('urlInput')).toHaveValue('https://x/f ')
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
