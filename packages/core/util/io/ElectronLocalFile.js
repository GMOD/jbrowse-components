const { ipcRenderer } = window.electronBetterIpc
// const fsOpen = fs && promisify(fs.open)
// const fsRead = fs && promisify(fs.read)
// const fsFStat = fs && promisify(fs.fstat)
// const fsReadFile = fs && promisify(fs.readFile)

ipcRenderer.on('asynchronous-reply', (event, arg) => {
  console.log(`Asynchronous message reply: ${arg}`)
})

export default class ElectronLocalFile {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(source) {
    this.filename = source
    // console.log('sending asynchronous-message ping')
    // ipcRenderer.send('asynchronous-message', 'ping')
  }

  async getFd() {
    if (!this.fd) this.fd = ipcRenderer.callMain('open', [this.filename, 'r'])
    return this.fd
  }

  async read(buffer, offset, length, position) {
    const fetchLength = Math.min(buffer.length - offset, length)
    const fd = await this.getFd()
    const { bytesRead, buffer: newBuf } = await ipcRenderer.callMain('read', [
      fd,
      buffer,
      offset,
      fetchLength,
      position,
    ])
    // console.log(bytesRead, newBuf)
    return { bytesRead, buffer: newBuf }
  }

  async readFile(options) {
    return ipcRenderer.callMain('readFile', [this.filename, options])
  }

  // todo memoize
  async stat() {
    return ipcRenderer.callMain('stat', [await this.getFd()])
  }
}
