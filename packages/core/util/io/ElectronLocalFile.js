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
    if (!this.fd) this.fd = ipcRenderer.callMain('open', this.filename, 'r')
    return this.fd
  }

  async read(buffer, offset, length, position) {
    const fetchLength = Math.min(buffer.length - offset, length)
    return {
      bytesRead: ipcRenderer.callMain(
        'read',
        await this.getFd(),
        buffer,
        offset,
        fetchLength,
        position,
      ),
      buffer,
    }
  }

  async readFile(options) {
    return ipcRenderer.callMain('readFile', this.filename)
  }

  // todo memoize
  async stat() {
    return ipcRenderer.callMain('stat', await this.getFd())
  }
}
