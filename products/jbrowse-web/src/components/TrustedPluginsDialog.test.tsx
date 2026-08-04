import { fireEvent, render } from '@testing-library/react'

import {
  arePluginsRemembered,
  forgetTrustedPlugins,
  rememberPlugins,
} from '../trustedPlugins.ts'
import TrustedPluginsDialog from './TrustedPluginsDialog.tsx'

const apollo = {
  name: 'Apollo',
  url: 'http://example.com/jbrowse-plugin-apollo.js',
}

beforeEach(() => {
  forgetTrustedPlugins()
})

test('lists what this origin trusts', () => {
  rememberPlugins([apollo])
  const { getByText } = render(<TrustedPluginsDialog onClose={() => {}} />)
  getByText(apollo.url)
})

test('forgetting revokes the approval and shows the empty state', () => {
  rememberPlugins([apollo])
  const { getByText, queryByText } = render(
    <TrustedPluginsDialog onClose={() => {}} />,
  )

  fireEvent.click(getByText('Forget all'))

  expect(arePluginsRemembered([apollo])).toBe(false)
  expect(queryByText(apollo.url)).toBeNull()
  getByText(/No plugins are trusted on this site/)
})

test('says so when nothing is trusted', () => {
  const { getByText, queryByText } = render(
    <TrustedPluginsDialog onClose={() => {}} />,
  )
  getByText(/No plugins are trusted on this site/)
  expect(queryByText('Forget all')).toBeNull()
})
