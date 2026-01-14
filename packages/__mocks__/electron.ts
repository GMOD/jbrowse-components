import createIPCMock from 'electron-mock-ipc'
const { ipcMain, ipcRenderer } = createIPCMock()

// @ts-expect-error
window.require = () => {
  return {
    ipcRenderer,
    ipcMain,
  }
}

export { ipcMain, ipcRenderer }
