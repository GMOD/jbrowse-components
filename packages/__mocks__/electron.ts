import createIPCMock from 'electron-mock-ipc'

const mocked = createIPCMock()
const ipcMain = mocked.ipcMain
const ipcRenderer = mocked.ipcRenderer
const mockedElectron = {
  ...jest.requireActual('electron'),
  ipcRenderer,
  ipcMain,
}

export default mockedElectron
