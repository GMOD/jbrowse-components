import HelloWorker from './hello.worker'

export default function register() {
  const helloWorker = new HelloWorker()
  let messageCount = 0

  helloWorker.postMessage({ run: true })

  helloWorker.onmessage = event => {
    if (event.data.status) {
      console.log('STATUS', event.data.status)
    }

    if (event.data.message) {
      messageCount += 1
      console.log('MESSAGE', event.data.message)

      if (messageCount >= 5) {
        helloWorker.postMessage({ run: false })
      }
    }
  }
}
