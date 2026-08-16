import '@testing-library/jest-dom'

import { useState } from 'react'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { initialFormState } from '../util/assemblyConfigUtils.ts'
import AddGenomePane from './AddGenomePane.tsx'

// The pane is uncontrolled from its own point of view — the caller owns the
// FormState — so each test drives a host that owns it and reports the latest.
function setup({ onStageAnother }: { onStageAnother?: () => void } = {}) {
  const user = userEvent.setup()
  let latest = initialFormState()
  function Host() {
    const [form, setForm] = useState(initialFormState)
    latest = form
    return (
      <AddGenomePane
        form={form}
        setForm={setForm}
        onStageAnother={onStageAnother}
      />
    )
  }
  render(<Host />)
  return { user, form: () => latest }
}

const urlBox = () => screen.getByTestId('genome-urls')

// which toggle the FIRST missing-index selector opened on. Read off the DOM
// rather than by accessible name: a .fa.gz is missing two indexes, so the pane
// renders the same pair of toggles twice.
const sourceToggles = () =>
  [...document.querySelectorAll('[aria-pressed]')]
    .slice(0, 2)
    .map(
      b => `${b.getAttribute('aria-label')}=${b.getAttribute('aria-pressed')}`,
    )

async function pasteUrls(
  user: ReturnType<typeof userEvent.setup>,
  text: string,
) {
  await user.click(screen.getByText('Open from a URL'))
  await user.click(urlBox())
  await user.paste(text)
}

// The URL box used to unmount the moment the text in it classified as a
// sequence, which for a .fa.gz happens two characters early: typing stopped
// landing at "hg38.fa" and the assembly pointed at a URL that does not exist.
test('a url typed one character at a time survives being recognized', async () => {
  const { user, form } = setup()
  await user.click(screen.getByText('Open from a URL'))
  await user.type(urlBox(), 'https://example.com/hg38.fa.gz')

  expect(form().fastaLocation).toEqual({
    uri: 'https://example.com/hg38.fa.gz',
    locationType: 'UriLocation',
  })
  expect(form().adapterSelection).toBe('BgzipFastaAdapter')
  expect(urlBox()).toHaveValue('https://example.com/hg38.fa.gz')
})

test('a second url can be added after the first is recognized', async () => {
  const { user, form } = setup()
  await pasteUrls(user, 'https://example.com/hg38.fa\n')
  await user.paste('https://example.com/hg38.fa.fai')

  expect(form().adapterSelection).toBe('IndexedFastaAdapter')
  expect(form().faiLocation).toEqual({
    uri: 'https://example.com/hg38.fa.fai',
    locationType: 'UriLocation',
  })
})

test('an index on its own says what it is still waiting for', async () => {
  const { user } = setup()
  await pasteUrls(user, 'https://example.com/hg38.fa.fai')

  expect(screen.getByText(/Got hg38\.fa\.fai/)).toBeInTheDocument()
})

test('two genomes at once says which one it kept', async () => {
  const { user, form } = setup()
  await pasteUrls(
    user,
    ['https://example.com/hg38.fa', 'https://example.com/mm39.2bit'].join('\n'),
  )

  expect(form().assemblyName).toBe('mm39')
  expect(screen.getByText(/only mm39\.2bit is being read/)).toBeInTheDocument()
})

test('a file the format cannot use is named as ignored', async () => {
  const { user } = setup()
  await pasteUrls(
    user,
    [
      'https://example.com/hg38.fa',
      'https://example.com/hg38.fa.fai',
      'https://example.com/hg38.chrom.sizes',
    ].join('\n'),
  )

  expect(screen.getByText(/Also loading: hg38\.fa\.fai/)).toBeInTheDocument()
  expect(
    screen.getByText(/does not use hg38\.chrom\.sizes/),
  ).toBeInTheDocument()
})

test('an unplaceable file is reported alongside a recognized genome', async () => {
  const { user } = setup()
  await pasteUrls(
    user,
    ['https://example.com/hg38.fa', 'https://example.com/notes.md'].join('\n'),
  )

  expect(screen.getByText(/Couldn't place: notes\.md/)).toBeInTheDocument()
  expect(screen.getByTestId('assembly-name')).toHaveValue('hg38')
})

// asking someone who just pasted three URLs to browse for the fourth file is a
// question the box above the input has already answered
test('the missing-index input opens on URL for someone entering URLs', async () => {
  const { user } = setup()
  await pasteUrls(user, 'https://example.com/hg38.fa.gz')

  expect(sourceToggles()).toEqual(['local file=false', 'url=true'])
})

test('and on File for someone picking local files', async () => {
  const { user, form } = setup()
  await user.upload(
    document.querySelector<HTMLInputElement>('input[type="file"]')!,
    new File(['>chr1\nACGT\n'], 'hg38.fa.gz'),
  )

  expect(form().adapterSelection).toBe('BgzipFastaAdapter')
  expect(sourceToggles()).toEqual(['local file=true', 'url=false'])
})

test('staging is offered only once the genome has a name', async () => {
  const { user } = setup({ onStageAnother: () => {} })
  await pasteUrls(user, 'https://example.com/hg38.fa')
  expect(
    screen.getByRole('button', { name: 'Add another genome' }),
  ).toBeEnabled()

  await user.clear(screen.getByTestId('assembly-name'))
  expect(
    screen.getByRole('button', { name: 'Add another genome' }),
  ).toBeDisabled()
})
