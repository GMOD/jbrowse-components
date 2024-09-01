const { ipcRenderer } = window.require('electron')

export default async function factoryReset() {
  await ipcRenderer.invoke('reset')
  window.location.reload()
}
