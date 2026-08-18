import { fireEvent, render } from '@testing-library/react'

import CrisprGuidePanel from './CrisprGuidePanel.tsx'

// the panel only touches the session on submit, so rendering needs no more than
// the shape of the model
const model = { assemblyNames: ['volvox'], showTrack: () => {} }

function renderPanel() {
  const utils = render(
    <CrisprGuidePanel model={model} handleClose={() => {}} />,
  )
  const submit = () => utils.getByText('Submit').closest('button')!
  const chooseCustom = () => {
    fireEvent.mouseDown(utils.getByRole('combobox'))
    fireEvent.click(utils.getByRole('option', { name: 'Custom' }))
  }
  return { ...utils, submit, chooseCustom }
}

test('a preset opens ready to submit, with no custom geometry fields', () => {
  const { submit, getByText, queryByLabelText } = renderPanel()
  expect(getByText(/PAM NGG · 20 bp guide · cut 3 bp from PAM/)).toBeTruthy()
  expect(queryByLabelText('Cut offset (bp)')).toBeNull()
  expect(submit().disabled).toBe(false)
})

// The cut-offset rule below is a relation between two slots, so a preset can
// violate it — Cas12a's 18/23 pair against a 23bp guide sits right on the edge.
test('every enzyme preset satisfies the panel’s own validation', () => {
  const { submit, getByRole, getAllByRole } = renderPanel()
  fireEvent.mouseDown(getByRole('combobox'))
  const names = getAllByRole('option')
    .map(o => o.textContent)
    .filter(n => n !== 'Custom')
  expect(names).toContain('Cas12a (Cpf1)')
  for (const name of names) {
    fireEvent.click(getByRole('option', { name }))
    expect(submit().disabled).toBe(false)
    fireEvent.mouseDown(getByRole('combobox'))
  }
})

test('an emptied cut offset is an error, not a silent zero', () => {
  const { submit, chooseCustom, getByLabelText, getByText } = renderPanel()
  chooseCustom()
  fireEvent.change(getByLabelText('Cut offset (bp)'), { target: { value: '' } })
  expect(getByText('bp from the PAM, within the guide')).toBeTruthy()
  expect(submit().disabled).toBe(true)
})

test('an emptied guide length is an error, not a silent zero', () => {
  const { submit, chooseCustom, getByLabelText, getByText } = renderPanel()
  chooseCustom()
  fireEvent.change(getByLabelText('Guide length (bp)'), {
    target: { value: '' },
  })
  expect(getByText('A whole number of bp')).toBeTruthy()
  expect(submit().disabled).toBe(true)
})

test('a cut offset past the end of the protospacer is rejected', () => {
  const { submit, chooseCustom, getByLabelText } = renderPanel()
  chooseCustom()
  fireEvent.change(getByLabelText('Cut offset (bp)'), {
    target: { value: '3' },
  })
  fireEvent.change(getByLabelText('Guide length (bp)'), {
    target: { value: '20' },
  })
  expect(submit().disabled).toBe(false)
  // a cut outside the guide would draw its tick outside the glyph carrying it
  fireEvent.change(getByLabelText('Cut offset (bp)'), {
    target: { value: '21' },
  })
  expect(submit().disabled).toBe(true)
})

test('a non-IUPAC custom PAM is rejected', () => {
  const { submit, chooseCustom, getByLabelText, getByText } = renderPanel()
  chooseCustom()
  fireEvent.change(getByLabelText('PAM (IUPAC)'), { target: { value: 'XYZ' } })
  expect(getByText('Use IUPAC codes only')).toBeTruthy()
  expect(submit().disabled).toBe(true)
})
