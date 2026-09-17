import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { render, waitForElementToBeRemoved } from '@testing-library/react'

import DescriptionPanel from './DescriptionPanel.tsx'
import { makeTrackConf } from './aboutTestUtils.ts'

import type { AbstractSessionModel } from '@jbrowse/core/util'

const mockReadFile = jest.fn()

jest.mock('@jbrowse/core/util/io', () => ({
  openLocation: () => ({ readFile: mockReadFile }),
}))

const base = 'https://hgdownload.soe.ucsc.edu/hubs/GCF/x/html/x.repeatMasker'
const session = {} as AbstractSessionModel

function renderPanel(metadata: Record<string, unknown>) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <DescriptionPanel
        config={makeTrackConf({ trackId: 't1', metadata })}
        session={session}
      />
    </ThemeProvider>,
  )
}

beforeEach(() => {
  mockReadFile.mockReset()
})

test('renders nothing for a track with no description page', () => {
  const { container } = renderPanel({ ucsc: { track: 'gc5Base' } })
  expect(container.innerHTML).toBe('')
  expect(mockReadFile).not.toHaveBeenCalled()
})

test('fetches and renders the hub page, rebased', async () => {
  mockReadFile.mockResolvedValue('<h2>Description</h2><img src="mammals.png">')
  const { getByText, queryByText, container } = renderPanel({
    html: `<a href="${base}">html/x.repeatMasker</a>`,
  })
  await waitForElementToBeRemoved(() => queryByText('Loading description'))
  expect(getByText('Description', { selector: 'h2' })).toBeTruthy()
  expect(container.querySelector('img')?.getAttribute('src')).toBe(
    'https://hgdownload.soe.ucsc.edu/hubs/GCF/x/html/mammals.png',
  )
})

// the page describes the UCSC browser's own display options, so the card says
// whose page it is and links to it rather than passing it off as JBrowse's
test('attributes the page and links to the original', async () => {
  mockReadFile.mockResolvedValue('<p>hi</p>')
  const { getByText, queryByText } = renderPanel({
    ucsc: { html: `<a href="${base}">x</a>` },
  })
  await waitForElementToBeRemoved(() => queryByText('Loading description'))
  expect(getByText(/written for the UCSC Genome Browser/)).toBeTruthy()
  expect(getByText('View original').getAttribute('href')).toBe(base)
})

// the sanitizer is the whole defence for markup off a third-party origin
test('strips scripting from the fetched page', async () => {
  mockReadFile.mockResolvedValue(
    '<p>real</p><script>window.pwned = 1</script><img src="x" onerror="window.pwned = 1">',
  )
  const { getByText, queryByText, container } = renderPanel({
    html: `<a href="${base}">x</a>`,
  })
  await waitForElementToBeRemoved(() => queryByText('Loading description'))
  expect(getByText('real')).toBeTruthy()
  expect(container.querySelector('script')).toBeNull()
  expect(container.querySelector('img')?.getAttribute('onerror')).toBeNull()
})

test('surfaces a fetch failure instead of spinning', async () => {
  mockReadFile.mockRejectedValue(new Error('404 fetching description'))
  const { getByText, queryByText } = renderPanel({
    html: `<a href="${base}">x</a>`,
  })
  await waitForElementToBeRemoved(() => queryByText('Loading description'))
  expect(getByText(/404 fetching description/)).toBeTruthy()
})
