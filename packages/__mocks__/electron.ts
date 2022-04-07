import createIPCMock from 'electron-mock-ipc'
const { ipcMain, ipcRenderer } = createIPCMock()

// @ts-ignore
window.require = () => {
  return {
    ...jest.requireActual('electron'),
    ipcRenderer,
    ipcMain,
  }
}

export { ipcMain, ipcRenderer }
