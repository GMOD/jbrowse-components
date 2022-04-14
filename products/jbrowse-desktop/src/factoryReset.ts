const { ipcRenderer } = window.require('electron')

export default async function factoryReset() {
  if (ipcRenderer) {
    await ipcRenderer.invoke('reset')
    window.location.reload()
  }
}
