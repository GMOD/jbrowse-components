import createIPCMock from 'electron-mock-ipc'
const { ipcMain, ipcRenderer } = createIPCMock()

// @ts-expect-error
window.require = () => {
  return {
    ...jest.requireActual('electron'),
    ipcMain,
    ipcRenderer,
  }
}

export { ipcMain, ipcRenderer }
