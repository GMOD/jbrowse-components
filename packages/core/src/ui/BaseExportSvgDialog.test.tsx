import '@testing-library/jest-dom'

import { types } from '@jbrowse/mobx-state-tree'
import { fireEvent, render, waitFor } from '@testing-library/react'

import { ConfigurationSchema } from '../configuration/index.ts'
import BaseExportSvgDialog from './BaseExportSvgDialog.tsx'

// `getSession` walks up to the first node carrying `rpcManager` and
// `configuration`, so a session is those two plus the dialog's own subject.
function stubModel(themeName: string) {
  return types
    .model('Session', {
      rpcManager: types.optional(types.frozen(), {}),
      configuration: ConfigurationSchema('test', {}),
      subject: types.optional(types.model('Subject', {}), {}),
    })
    .views(() => ({
      allThemes: () => ({ default: { name: 'Default' }, lightStock: {} }),
      get themeName() {
        return themeName
      },
    }))
    .create({}).subject
}

async function exportedThemeName(sessionTheme: string) {
  const exportSvg = jest.fn().mockResolvedValue(undefined)
  const { getByRole } = render(
    <BaseExportSvgDialog
      model={stubModel(sessionTheme)}
      handleClose={() => {}}
      exportSvg={exportSvg}
    />,
  )
  fireEvent.click(getByRole('button', { name: 'Submit' }))
  await waitFor(() => {
    expect(exportSvg).toHaveBeenCalled()
  })
  return exportSvg.mock.calls[0][0].themeName
}

beforeEach(() => {
  localStorage.clear()
})

test('a stored theme that still exists is used', async () => {
  localStorage.setItem('svg-theme', JSON.stringify('lightStock'))

  expect(await exportedThemeName('default')).toBe('lightStock')
})

// An admin drops an `extraThemes` entry, or another JBrowse on this origin
// writes the key. Unguarded, `getActiveThemeOptions` answers undefined for the
// stale name and the export loses the config theme with it.
test('a stored theme that no longer exists falls back to the session theme', async () => {
  localStorage.setItem('svg-theme', JSON.stringify('themeThatWasRemoved'))

  expect(await exportedThemeName('lightStock')).toBe('lightStock')
})

test('the R format hands the filename to exportR and hides the image options', async () => {
  const exportSvg = jest.fn().mockResolvedValue(undefined)
  const exportR = jest.fn().mockResolvedValue(undefined)
  const { getByRole, getByText, getByLabelText, queryByLabelText } = render(
    <BaseExportSvgDialog
      model={stubModel('default')}
      handleClose={() => {}}
      exportSvg={exportSvg}
      exportR={exportR}
    />,
  )
  fireEvent.click(getByRole('button', { name: 'R' }))

  expect(queryByLabelText('Font')).toBeNull()
  expect(getByText('Rscript jbrowse.R')).toBeInTheDocument()
  fireEvent.change(getByLabelText('Filename'), {
    target: { value: 'my locus.R' },
  })
  expect(getByText('Rscript "my locus.R"')).toBeInTheDocument()
  fireEvent.change(getByLabelText('Filename'), {
    target: { value: 'jbrowse.R' },
  })
  fireEvent.click(getByRole('button', { name: 'Submit' }))
  await waitFor(() => {
    expect(exportR).toHaveBeenCalledWith('jbrowse.R')
  })
  expect(exportSvg).not.toHaveBeenCalled()
})

// The format and filename are stored once for every view's dialog, and only
// the linear genome view offers R.
test('a stored R format exports an SVG from a dialog without exportR', async () => {
  localStorage.setItem('svg-format', JSON.stringify('r'))
  localStorage.setItem('svg-file', JSON.stringify('locus.R'))
  const exportSvg = jest.fn().mockResolvedValue(undefined)
  const { getByRole, queryByRole } = render(
    <BaseExportSvgDialog
      model={stubModel('default')}
      handleClose={() => {}}
      exportSvg={exportSvg}
    />,
  )

  expect(queryByRole('button', { name: 'R' })).toBeNull()
  fireEvent.click(getByRole('button', { name: 'Submit' }))
  await waitFor(() => {
    expect(exportSvg).toHaveBeenCalled()
  })
  expect(exportSvg.mock.calls[0][0]).toMatchObject({
    format: 'svg',
    filename: 'locus.svg',
  })
})
