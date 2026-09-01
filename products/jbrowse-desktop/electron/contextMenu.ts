// The subset of electron-context-menu the app actually used, in TypeScript so
// the compiler sees it. The package was vendored after its `copyLink` broke on
// electron 44 — it calls a `clipboard.write` signature electron removed, and
// because the package ships unchecked .js behind a hand-written .d.ts, nothing
// failed at the upgrade and Copy Link silently copied nothing.
import { Menu, app, clipboard, shell } from 'electron'

import { logError } from './util.ts'

import type {
  BrowserWindow,
  ContextMenuParams,
  MenuItemConstructorOptions,
  WebContents,
} from 'electron'

const SELECTION_LABEL_LIMIT = 25

const separator = () => ({ type: 'separator' as const })

// `&` is the mnemonic marker in an electron menu label, so a selection
// containing one has to double it to survive as a literal.
function selectionLabel(text: string) {
  const trimmed = text.trim()
  const truncated =
    trimmed.length > SELECTION_LABEL_LIMIT
      ? `${trimmed.slice(0, SELECTION_LABEL_LIMIT - 1)}…`
      : trimmed
  return truncated.replaceAll('&', '&&')
}

function spellingItems(webContents: WebContents, params: ContextMenuParams) {
  const { misspelledWord, dictionarySuggestions, isEditable } = params
  return isEditable && misspelledWord
    ? [
        ...(dictionarySuggestions.length > 0
          ? dictionarySuggestions.map(suggestion => ({
              label: suggestion,
              click: () => {
                webContents.replaceMisspelling(suggestion)
              },
            }))
          : [{ label: 'No Guesses Found', enabled: false }]),
        separator(),
        {
          label: '&Learn Spelling',
          click: () => {
            webContents.session.addWordToSpellCheckerDictionary(misspelledWord)
          },
        },
      ]
    : []
}

function buildTemplate(webContents: WebContents, params: ContextMenuParams) {
  const { editFlags, isEditable, linkURL, mediaType, selectionText, x, y } =
    params
  const hasText = selectionText.length > 0
  const isLink = linkURL.length > 0

  return [
    ...spellingItems(webContents, params),
    separator(),
    process.platform === 'darwin' &&
      hasText &&
      !isLink && {
        label: `Look Up “${selectionLabel(selectionText)}”`,
        click: () => {
          webContents.showDefinitionForSelection()
        },
      },
    separator(),
    hasText && {
      label: '&Search with Google',
      click: () => {
        const url = new URL('https://www.google.com/search')
        url.searchParams.set('q', selectionText)
        shell.openExternal(url.toString()).catch(logError)
      },
    },
    separator(),
    isEditable && {
      label: 'Cu&t',
      enabled: editFlags.canCut && hasText,
      click: () => {
        webContents.cut()
      },
    },
    (isEditable || hasText) && {
      label: '&Copy',
      enabled: editFlags.canCopy && hasText,
      click: () => {
        webContents.copy()
      },
    },
    isEditable && {
      label: '&Paste',
      enabled: editFlags.canPaste,
      click: () => {
        webContents.paste()
      },
    },
    process.platform !== 'darwin' && {
      label: 'Select &All',
      click: () => {
        webContents.selectAll()
      },
    },
    separator(),
    mediaType === 'image' && {
      label: 'Cop&y Image',
      click: () => {
        webContents.copyImageAt(x, y)
      },
    },
    separator(),
    isLink &&
      mediaType === 'none' && {
        label: 'Copy Lin&k',
        click: () => {
          clipboard.writeText(linkURL).catch(logError)
        },
      },
    separator(),
    !app.isPackaged && {
      label: 'I&nspect Element',
      click: () => {
        webContents.inspectElement(x, y)
        if (webContents.isDevToolsOpened()) {
          webContents.devToolsWebContents?.focus()
        }
      },
    },
  ]
}

// A separator only earns its place between two items, so the ones orphaned by
// an item that did not apply to this click are dropped.
function pruneSeparators(items: MenuItemConstructorOptions[]) {
  const kept: MenuItemConstructorOptions[] = []
  for (const item of items) {
    if (
      item.type !== 'separator' ||
      (kept.length > 0 && kept.at(-1)?.type !== 'separator')
    ) {
      kept.push(item)
    }
  }
  while (kept.at(-1)?.type === 'separator') {
    kept.pop()
  }
  return kept
}

function showMenu(window: BrowserWindow, params: ContextMenuParams) {
  const template = pruneSeparators(
    buildTemplate(window.webContents, params).filter(item => item !== false),
  )
  if (template.length > 0) {
    Menu.buildFromTemplate(template).popup({ window })
  }
}

export function registerContextMenu() {
  app.on('browser-window-created', (_event, window) => {
    window.webContents.on('context-menu', (_e, params) => {
      showMenu(window, params)
    })
  })
}
