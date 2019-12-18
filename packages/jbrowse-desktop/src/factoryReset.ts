export default async function factoryReset() {
  const { electronBetterIpc = {} } = window
  const { ipcRenderer } = electronBetterIpc
  if (ipcRenderer) {
    await ipcRenderer.invoke('reset')
    window.location.reload()
  }
}
