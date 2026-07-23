import { isPalindromic, parseMotifList } from '@jbrowse/core/util'
import { fireEvent, render } from '@testing-library/react'

import MotifListPanel from './MotifListPanel.tsx'
import { DEFAULT_MOTIFS } from './defaultMotifs.ts'

// the panel only touches the session on submit, so rendering needs no more than
// the shape of the model
const model = { assemblyNames: ['volvox'], showTrack: () => {} }

// The default list is the textarea's initial value, so a typo in it would open
// the dialog in an error state with Submit disabled.
test('the prefilled enzyme list parses cleanly', () => {
  const { motifs, errors } = parseMotifList(DEFAULT_MOTIFS)
  expect(errors).toEqual([])
  expect(motifs.length).toBeGreaterThan(10)
})

test('every prefilled enzyme has a cut position inside its site', () => {
  const { motifs } = parseMotifList(DEFAULT_MOTIFS)
  for (const m of motifs) {
    expect(m.cutOffset).toBeDefined()
    expect(m.cutOffset).toBeLessThanOrEqual(m.site.length)
  }
  expect(motifs.find(m => m.name === 'EcoRI')).toEqual({
    name: 'EcoRI',
    site: 'GAATTC',
    cutOffset: 1,
  })
})

test('the prefilled enzymes are all palindromic', () => {
  const { motifs } = parseMotifList(DEFAULT_MOTIFS)
  expect(motifs.filter(m => !isPalindromic(m.site))).toEqual([])
})

test('opens ready to submit, with strand controls hidden for palindromes', () => {
  const { getByText, queryByText } = render(
    <MotifListPanel model={model} handleClose={() => {}} />,
  )
  const { motifs } = parseMotifList(DEFAULT_MOTIFS)
  expect(getByText(`${motifs.length} motifs`)).toBeTruthy()
  expect(getByText(/All motifs are palindromic/)).toBeTruthy()
  expect(queryByText('Forward strand')).toBeNull()
  expect(getByText('Launch as one track').closest('button')!.disabled).toBe(
    false,
  )
  expect(
    getByText('Launch one track per motif').closest('button')!.disabled,
  ).toBe(false)
})

test('a non-palindromic motif brings the strand controls back', () => {
  const { getByLabelText, getByText } = render(
    <MotifListPanel model={model} handleClose={() => {}} />,
  )
  fireEvent.change(getByLabelText('Motifs'), {
    target: { value: 'BsaI GGTCTC' },
  })
  expect(getByText('1 motif')).toBeTruthy()
  expect(getByText('Forward strand')).toBeTruthy()
})

test('a bad line blocks submit and points at the line', () => {
  const { getByLabelText, getByText } = render(
    <MotifListPanel model={model} handleClose={() => {}} />,
  )
  fireEvent.change(getByLabelText('Motifs'), {
    target: { value: 'EcoRI G^AATTC\nOops GAXTTC' },
  })
  expect(getByText(/Line 2:.*non-IUPAC/)).toBeTruthy()
  expect(getByText('Launch as one track').closest('button')!.disabled).toBe(
    true,
  )
})

test('a single motif has no per-motif split button, since there is nothing to split', () => {
  const { getByLabelText, queryByText } = render(
    <MotifListPanel model={model} handleClose={() => {}} />,
  )
  fireEvent.change(getByLabelText('Motifs'), {
    target: { value: 'BsaI GGTCTC' },
  })
  expect(queryByText('Launch one track per motif')).toBeNull()
})
