import { dialog, shell } from 'electron'

import { askAboutVersion } from './autoUpdater.ts'

jest.mock('electron', () => ({
  dialog: { showMessageBox: jest.fn() },
  shell: { openExternal: jest.fn() },
}))

const showMessageBox = jest.mocked(dialog.showMessageBox)
const openExternal = jest.mocked(shell.openExternal)

function click(response: number) {
  showMessageBox.mockResolvedValueOnce({ response, checkboxChecked: false })
}

beforeEach(() => {
  showMessageBox.mockReset()
  openExternal.mockReset()
  openExternal.mockResolvedValue(undefined)
})

const question = {
  version: '4.3.1',
  title: 'Found updates',
  message: 'Version 4.3.1 is available, do you want to update now?',
  buttons: ['Yes', 'No'] as [string, string],
}

test('the answers are the caller-supplied buttons, in order', async () => {
  click(0)
  expect(await askAboutVersion(question)).toBe(0)
  click(1)
  expect(await askAboutVersion(question)).toBe(1)
  expect(openExternal).not.toHaveBeenCalled()
  expect(showMessageBox.mock.calls[0]![0].buttons).toEqual([
    'Yes',
    'No',
    'Release notes',
  ])
})

// a message box has no clickable links, so the notes are a button — and since
// any button closes the box, it must come back rather than count as an answer
test('release notes open the browser and ask again', async () => {
  click(2)
  click(2)
  click(0)
  expect(await askAboutVersion(question)).toBe(0)
  expect(showMessageBox).toHaveBeenCalledTimes(3)
  expect(openExternal).toHaveBeenCalledTimes(2)
  expect(openExternal).toHaveBeenLastCalledWith(
    'https://github.com/GMOD/jbrowse-components/releases/tag/v4.3.1',
  )
})

// esc/close resolves to cancelId, which must be the decline, not the notes
test('dismissing the box declines', async () => {
  click(1)
  expect(await askAboutVersion(question)).toBe(1)
  expect(showMessageBox.mock.calls[0]![0].cancelId).toBe(1)
})
