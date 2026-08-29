import '@testing-library/jest-dom'

import { useState } from 'react'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { initialFormState, isBlank } from '../util/assemblyConfigUtils.ts'
import AddGenomePane from './AddGenomePane.tsx'

// The pane is uncontrolled from its own point of view — the caller owns the
// FormState — so each test drives a host that owns it and reports the latest.
function setup({
  onStageAnother,
}: { onStageAnother?: () => Promise<boolean> } = {}) {
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

const stageButton = () =>
  screen.getByRole('button', { name: 'Add another genome' })

test('staging is offered only once the genome has a name', async () => {
  const { user } = setup({ onStageAnother: async () => true })
  await pasteUrls(user, 'https://example.com/hg38.fa')
  expect(stageButton()).toBeEnabled()

  await user.clear(screen.getByTestId('assembly-name'))
  expect(stageButton()).toBeDisabled()
})

// it gated on the name alone, so a format still missing its index staged
// straight into getAdapterConfig's own "FASTA, FAI, and GZI locations are all
// required" — while the caller's submit button, on isFormReady, was disabled
test('nor before the format has the indexes it needs', async () => {
  const { user } = setup({ onStageAnother: async () => true })
  await pasteUrls(user, 'https://example.com/hg38.fa.gz')

  expect(stageButton()).toBeDisabled()
})

// the inputs used to clear on the click rather than on the result, which left
// the card describing a genome whose files had gone from the box
test('a refused staging leaves the inputs where they were', async () => {
  const { user } = setup({ onStageAnother: async () => false })
  await pasteUrls(user, 'https://example.com/hg38.2bit')
  await user.click(stageButton())

  expect(urlBox()).toHaveValue('https://example.com/hg38.2bit')
  expect(screen.getByTestId('assembly-name')).toHaveValue('hg38')
})

test('and a staging that lands clears them', async () => {
  const { user } = setup({ onStageAnother: async () => true })
  await pasteUrls(user, 'https://example.com/hg38.2bit')
  await user.click(stageButton())

  expect(urlBox()).toHaveValue('')
})

// the notice and the recognition card disagreed: the .2bit took the adapter and
// the .fa took the name, so the form opened one genome under the other's name
test('two genomes at once: the notice names the file the card shows', async () => {
  const { user, form } = setup()
  await pasteUrls(
    user,
    ['https://example.com/mm39.2bit', 'https://example.com/hg38.fa'].join('\n'),
  )

  expect(screen.getByText(/only hg38\.fa is being read/)).toBeInTheDocument()
  expect(screen.getByText('hg38.fa')).toBeInTheDocument()
  expect(form().assemblyName).toBe('hg38')
  expect(form().adapterSelection).toBe('FastaAdapter')
  expect(isBlank(form().twoBitLocation)).toBe(true)
})

// a presigned S3/GCS link is one of the two normal ways to share a genome, and
// the pane answered "Couldn't place" because its patterns end-anchor the name
test('a presigned url is placed like any other', async () => {
  const { user, form } = setup()
  await pasteUrls(user, 'https://example.com/hg38.fa.gz?X-Amz-Signature=abc')

  expect(form().adapterSelection).toBe('BgzipFastaAdapter')
  expect(screen.getByTestId('assembly-name')).toHaveValue('hg38')
  expect(screen.queryByText(/Couldn't place/)).not.toBeInTheDocument()
})

// the missing-index input writes the field directly, and the file set used to
// be authoritative over it, so the next paste blanked what had just been typed
test('an index entered inline survives adding one more url', async () => {
  const { user, form } = setup()
  await pasteUrls(user, 'https://example.com/hg38.fa.gz')
  await user.click(screen.getAllByLabelText(/Enter URL/i)[0]!)
  await user.paste('https://example.com/hg38.fa.gz.fai')

  await user.click(urlBox())
  await user.paste('\nhttps://example.com/hg38.fa.gz.gzi')

  expect(form().faiLocation).toEqual({
    uri: 'https://example.com/hg38.fa.gz.fai',
    locationType: 'UriLocation',
  })
  expect(form().adapterSelection).toBe('BgzipFastaAdapter')
  expect(screen.queryByText(/needs its index file/)).not.toBeInTheDocument()
})

// A .chrom.sizes is the one genome the pane accepts that carries no bases, and
// the pane is the last place anyone is told so — after this the assembly just
// exists and its base-level views are quietly empty.
test('a chrom.sizes is recognized and says what it costs', async () => {
  const { user, form } = setup()
  await pasteUrls(user, 'https://example.com/hg38.chrom.sizes')
  expect(form().adapterSelection).toBe('ChromSizesAdapter')
  expect(form().assemblyName).toBe('hg38')
  expect(screen.getByRole('alert')).toHaveTextContent(/no sequence/i)
  expect(screen.getByRole('alert')).toHaveTextContent(/CRAM/)
})

test('a genome that does carry sequence gets no such warning', async () => {
  const { user } = setup()
  await pasteUrls(user, 'https://example.com/hg38.2bit')
  expect(screen.queryByText(/will have no sequence/i)).not.toBeInTheDocument()
})

// the 2bit's optional sidecar, not a sequence-free genome
test('a chrom.sizes beside a 2bit warns about nothing', async () => {
  const { user, form } = setup()
  await pasteUrls(
    user,
    'https://example.com/hg38.2bit\nhttps://example.com/hg38.chrom.sizes',
  )
  expect(form().adapterSelection).toBe('TwoBitAdapter')
  expect(screen.queryByText(/will have no sequence/i)).not.toBeInTheDocument()
})
