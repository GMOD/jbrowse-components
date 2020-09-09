// eslint-disable-next-line import/no-extraneous-dependencies
window.electron = require('electron')
window.electronBetterIpc = require('electron-better-ipc-extra')

if (process.env.NODE_ENV !== 'production')
  // eslint-disable-next-line no-underscore-dangle
  window.__devtron = { require, process }
