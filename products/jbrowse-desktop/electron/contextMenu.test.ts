import { clipboard } from 'electron'

import { buildContextMenuTemplate } from './contextMenu.ts'

import type {
  ContextMenuParams,
  MenuItemConstructorOptions,
  WebContents,
} from 'electron'

jest.mock('electron', () => ({
  app: { isPackaged: true, on: jest.fn() },
  clipboard: { writeText: jest.fn() },
  shell: { openExternal: jest.fn() },
  Menu: { buildFromTemplate: jest.fn() },
}))

const writeText = jest.mocked(clipboard.writeText)

// Every handler here ignores the (menuItem, window, event) electron passes.
const noArgs = [] as unknown as Parameters<
  NonNullable<MenuItemConstructorOptions['click']>
>

const webContents = {
  copy: jest.fn(),
  cut: jest.fn(),
  paste: jest.fn(),
} as unknown as WebContents

function paramsFor(overrides: Partial<ContextMenuParams>) {
  return {
    x: 0,
    y: 0,
    linkURL: '',
    mediaType: 'none',
    selectionText: '',
    isEditable: false,
    misspelledWord: '',
    dictionarySuggestions: [],
    editFlags: { canCut: true, canCopy: true, canPaste: true },
    ...overrides,
  } as ContextMenuParams
}

function labels(params: ContextMenuParams) {
  return buildContextMenuTemplate(webContents, params).map(item =>
    item.type === 'separator' ? '---' : item.label,
  )
}

beforeEach(() => {
  writeText.mockReset()
  writeText.mockResolvedValue(undefined)
})

test('Copy Link puts the url on the clipboard', () => {
  const params = paramsFor({ linkURL: 'https://jbrowse.org/jb2?a=1' })
  const item = buildContextMenuTemplate(webContents, params).find(
    i => i.label === 'Copy Lin&k',
  )
  item?.click?.(...noArgs)
  expect(writeText).toHaveBeenCalledWith('https://jbrowse.org/jb2?a=1')
})

test('a link that is also media gets no Copy Link', () => {
  expect(
    labels(
      paramsFor({ linkURL: 'https://jbrowse.org/x.png', mediaType: 'image' }),
    ),
  ).not.toContain('Copy Lin&k')
})

test('no separator leads, trails, or doubles up', () => {
  for (const params of [
    paramsFor({ linkURL: 'https://jbrowse.org' }),
    paramsFor({ selectionText: 'ACGT' }),
    paramsFor({ isEditable: true }),
    paramsFor({ mediaType: 'image' }),
    paramsFor({}),
  ]) {
    const rendered = labels(params)
    expect(rendered.at(0)).not.toBe('---')
    expect(rendered.at(-1)).not.toBe('---')
    expect(rendered.join(' ')).not.toContain('--- ---')
  }
})

test('Copy is disabled without a selection to copy', () => {
  const items = buildContextMenuTemplate(
    webContents,
    paramsFor({ isEditable: true }),
  )
  expect(items.find(i => i.label === '&Copy')?.enabled).toBe(false)
  expect(
    buildContextMenuTemplate(
      webContents,
      paramsFor({ isEditable: true, selectionText: 'ACGT' }),
    ).find(i => i.label === '&Copy')?.enabled,
  ).toBe(true)
})

test('a misspelling offers its suggestions, and a note when it has none', () => {
  expect(
    labels(
      paramsFor({
        isEditable: true,
        selectionText: 'chromsome',
        misspelledWord: 'chromsome',
        dictionarySuggestions: ['chromosome'],
      }),
    ),
  ).toContain('chromosome')
  expect(
    labels(
      paramsFor({
        isEditable: true,
        selectionText: 'zzz',
        misspelledWord: 'zzz',
        dictionarySuggestions: [],
      }),
    ),
  ).toContain('No Guesses Found')
})
