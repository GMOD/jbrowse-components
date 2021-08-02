import electron from 'electron'

export default async function factoryReset() {
  const { ipcRenderer } = electron
  if (ipcRenderer) {
    await ipcRenderer.invoke('reset')
    window.location.reload()
  }
}
