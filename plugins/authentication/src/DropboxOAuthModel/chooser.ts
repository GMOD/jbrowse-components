import { loadScript } from '../loadScript.ts'

interface ChosenFile {
  name: string
  link: string
}

interface DropboxDropins {
  choose: (options: {
    success: (files: ChosenFile[]) => void
    cancel: () => void
    linkType: 'preview' | 'direct'
    multiselect: boolean
    folderselect: boolean
  }) => void
}

declare global {
  interface Window {
    Dropbox?: DropboxDropins
  }
}

async function loadDropins(appKey: string) {
  if (!window.Dropbox) {
    await loadScript('https://www.dropbox.com/static/api/2/dropins.js', {
      id: 'dropboxjs',
      'data-app-key': appKey,
    })
  }
  const dropins = window.Dropbox
  if (!dropins) {
    throw new Error('Dropbox Chooser loaded without window.Dropbox')
  }
  return dropins
}

export async function chooseDropboxFile(appKey: string) {
  const dropins = await loadDropins(appKey)
  return new Promise<ChosenFile | undefined>(resolve => {
    dropins.choose({
      success: files => {
        resolve(files[0])
      },
      cancel: () => {
        resolve(undefined)
      },
      linkType: 'preview',
      multiselect: false,
      folderselect: false,
    })
  })
}
