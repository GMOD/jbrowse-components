import { fireEvent, render } from '@testing-library/react'

import {
  addPermanentPlugin,
  clearPermanentPlugins,
  getPermanentPlugins,
  readPermanentPlugins,
} from '../permanentPlugins.ts'
import PermanentPluginsDialog from './PermanentPluginsDialog.tsx'

// Safe mode is decided when the module is first imported, so the banner's two
// forms are pinned where that decision is made (permanentPlugins.test.ts) — a
// test here would have to reset the module registry, and a component the React
// Compiler touched cannot be rendered from a second copy of React.
const gwas = { name: 'GWAS', umdUrl: 'https://example.com/gwas.js' }

beforeEach(() => {
  clearPermanentPlugins()
})

test('lists what this JBrowse keeps, and removing takes it out', () => {
  addPermanentPlugin(gwas)
  const { getByText, getByRole, queryByText } = render(
    <PermanentPluginsDialog onClose={() => {}} />,
  )
  getByText(`GWAS (${gwas.umdUrl})`)

  fireEvent.click(getByRole('button', { name: 'Remove from this list' }))

  expect(readPermanentPlugins()).toEqual([])
  expect(queryByText(`GWAS (${gwas.umdUrl})`)).toBeNull()
  getByText(/No plugins are kept for this JBrowse/)
})

// Switching one off is what makes the safe-mode banner actionable: the list
// keeps the entry, so a user with several installed can find the culprit
// without reinstalling the innocent ones afterwards.
test('switching an entry off keeps it in the list but out of the load', () => {
  addPermanentPlugin(gwas)
  const { getByRole } = render(<PermanentPluginsDialog onClose={() => {}} />)

  fireEvent.click(getByRole('switch'))

  expect(readPermanentPlugins()).toEqual([{ ...gwas, disabled: true }])
  expect(getPermanentPlugins()).toEqual([])
  expect((getByRole('switch') as HTMLInputElement).checked).toBe(false)
})

test('says so when this JBrowse keeps nothing', () => {
  const { getByText, queryByText } = render(
    <PermanentPluginsDialog onClose={() => {}} />,
  )
  getByText(/No plugins are kept for this JBrowse/)
  expect(queryByText('Remove all')).toBeNull()
})
