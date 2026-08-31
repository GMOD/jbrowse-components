import { fireEvent, waitFor, within } from '@testing-library/react'

import {
  doBeforeEach,
  doSetupForImportForm,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

const config = volvoxConfigWithTracks([
  // exactly the tracks `trix/volvox_meta.json` indexes, so every search here can
  // still land on the track its hit names — and the selector stops mounting the
  // hundred rows no search in this file can reach
  'volvox_sv_test',
  'volvox_sv_test_renamed',
  'volvox_test_vcf',
  'gff3tabix_genes',
  'gff3tabix_canonical_tags',
  'volvox_filtered_vcf',
  'variant_colors',
  'single_exon_gene',
  'volvox.inv.vcf',
  'volvox.filtered.lowercase',
  'variant_effect_demo_data',
  'variant_effect_demo_jannovar',
  'test',
  'volvox_del_sv',
  'volvox multi-sample sv',
  'volvox_test_vcf_jexl',
])

const timeout = 50_000
const delay = { timeout }
const opts = [{}, delay]

async function getInput() {
  const rest = await doSetupForImportForm(config)
  return {
    ...rest,
    input: (await rest.findByPlaceholderText(
      'Search for location',
      ...opts,
    )) as HTMLInputElement,
  }
}

test(
  'search eden.1 and hit open',
  async () => {
    const { input, findByText, getInputValue } = await getInput()

    fireEvent.change(input, { target: { value: 'eden.1' } })
    fireEvent.click(await findByText('Open'))
    await waitFor(() => {
      expect(getInputValue()).toBe('ctgA:1..10,590')
    }, delay)
  },
  timeout,
)

test(
  'dialog with multiple results, searching seg02',
  async () => {
    const { input, findByText, findByRole } = await getInput()

    fireEvent.change(input, { target: { value: 'seg02' } })
    // wait for trix search results to load, then click the combined result
    fireEvent.click(
      within(await findByRole('listbox', ...opts)).getByText('seg02'),
    )
    fireEvent.click(await findByText('Open'))
    await findByText('Search results', ...opts)
  },
  timeout,
)

test(
  'search eden.1 and hit enter',
  async () => {
    const { getInputValue, autocomplete, input, findByText } = await getInput()

    fireEvent.change(input, { target: { value: 'eden.1' } })
    fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })
    fireEvent.click(await findByText('Open'))
    await waitFor(() => {
      expect(getInputValue()).toBe('ctgA:1..10,590')
    }, delay)
  },
  timeout,
)

test(
  'lower case refname, searching: contigb',
  async () => {
    const { getInputValue, findByRole, input, findByText } = await getInput()

    fireEvent.change(input, { target: { value: 'contigb' } })
    const listbox = await findByRole('listbox', ...opts)
    fireEvent.click(await within(listbox).findByText(/ctgB/, {}, delay))

    fireEvent.click(await findByText('Open'))

    await waitFor(() => {
      expect(getInputValue()).toBe('ctgB:1..6,079')
    }, delay)
  },
  timeout,
)

test(
  'lower case refname, click ctgB',
  async () => {
    const { getInputValue, findByRole, input, findByText } = await getInput()

    fireEvent.mouseDown(input)
    fireEvent.click(within(await findByRole('listbox')).getByText(/ctgB/))
    fireEvent.click(await findByText('Open'))

    await waitFor(() => {
      expect(getInputValue()).toBe('ctgB:1..6,079')
    }, delay)
  },
  timeout,
)

test(
  'description of gene, searching: kinase',
  async () => {
    const { getInputValue, autocomplete, input, findByText } = await getInput()

    fireEvent.change(input, { target: { value: 'kinase' } })
    fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })

    fireEvent.click(await findByText('EDEN (protein kinase)', ...opts))
    fireEvent.click(await findByText('Open'))
    await waitFor(() => {
      expect(getInputValue()).toBe('ctgA:1..10,590')
    }, delay)
  },
  timeout,
)

test(
  'search matches description for feature in two places',
  async () => {
    const { autocomplete, input, findByText } = await getInput()

    fireEvent.change(input, { target: { value: 'fingerprint' } })
    fireEvent.click(await findByText(/b101.2/, ...opts))
    fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })
    fireEvent.click(await findByText('Open'))
    await findByText('Search results', ...opts)
  },
  timeout,
)
