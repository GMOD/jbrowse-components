import { FAB_Z_INDEX } from '@jbrowse/core/ui/zIndexes'

import { loadScript } from '../loadScript.ts'

interface PickedDoc {
  id: string
  name: string
}

interface PickerResponse {
  action: string
  docs?: PickedDoc[]
}

interface Picker {
  setVisible: (visible: boolean) => void
}

interface DocsView {
  setIncludeFolders: (include: boolean) => DocsView
  setMode: (mode: string) => DocsView
}

interface PickerBuilder {
  addView: (view: DocsView) => PickerBuilder
  setOAuthToken: (token: string) => PickerBuilder
  setDeveloperKey: (key: string) => PickerBuilder
  setAppId: (appId: string) => PickerBuilder
  setCallback: (callback: (response: PickerResponse) => void) => PickerBuilder
  build: () => Picker
}

interface PickerNamespace {
  PickerBuilder: new () => PickerBuilder
  DocsView: new (viewId: string) => DocsView
  ViewId: { DOCS: string }
  DocsViewMode: { LIST: string }
  Action: { PICKED: string; CANCEL: string }
}

declare global {
  interface Window {
    gapi?: {
      load: (
        library: string,
        callbacks: { callback: () => void; onerror: () => void },
      ) => void
    }
    google?: { picker?: PickerNamespace }
  }
}

async function loadPickerNamespace() {
  if (!window.gapi) {
    await loadScript('https://apis.google.com/js/api.js')
  }
  const { gapi } = window
  if (!gapi) {
    throw new Error('Google API loader did not define gapi')
  }
  await new Promise<void>((resolve, reject) => {
    gapi.load('picker', {
      callback: () => {
        resolve()
      },
      onerror: () => {
        reject(new Error('Failed to load the Google Picker'))
      },
    })
  })
  const picker = window.google?.picker
  if (!picker) {
    throw new Error('Google Picker loaded without google.picker')
  }
  return picker
}

const PICKER_LAYER_STYLE_ID = 'jbrowse-google-picker-layer'

// The Picker stacks itself at ~1000 with inline styles, under the drawer
// (1200) and any dialog (1300) that opened it, and takes no z-index option
function raisePickerAboveApp() {
  if (!document.getElementById(PICKER_LAYER_STYLE_ID)) {
    const style = document.createElement('style')
    style.id = PICKER_LAYER_STYLE_ID
    style.textContent = `
.picker-dialog-bg { z-index: ${FAB_Z_INDEX + 1} !important; }
.picker-dialog { z-index: ${FAB_Z_INDEX + 2} !important; }`
    document.head.append(style)
  }
}

export async function pickDriveFile({
  token,
  apiKey,
  appId,
}: {
  token: string
  apiKey: string
  appId: string
}) {
  const picker = await loadPickerNamespace()
  raisePickerAboveApp()
  return new Promise<PickedDoc | undefined>(resolve => {
    new picker.PickerBuilder()
      .addView(
        new picker.DocsView(picker.ViewId.DOCS)
          .setIncludeFolders(true)
          .setMode(picker.DocsViewMode.LIST),
      )
      .setOAuthToken(token)
      .setDeveloperKey(apiKey)
      .setAppId(appId)
      .setCallback(response => {
        if (response.action === picker.Action.PICKED) {
          resolve(response.docs?.[0])
        } else if (response.action === picker.Action.CANCEL) {
          resolve(undefined)
        }
      })
      .build()
      .setVisible(true)
  })
}
