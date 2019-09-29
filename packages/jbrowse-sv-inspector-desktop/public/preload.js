const electron = require('electron')
const electronBetterIpc = require('electron-better-ipc')

console.log('preloading')

window.ELEC = electron
window.electronBetterIpc = electronBetterIpc
