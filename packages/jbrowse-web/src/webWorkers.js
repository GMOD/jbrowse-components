import HelloWorker from './hello.worker'
import RenderWorker from './render.worker'

function registerHello() {
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

  return helloWorker
}

function registerRender() {
  const renderWorker = new RenderWorker()
  return renderWorker
}

export function register() {
  return {
    // hello: [registerHello()],
    render: [registerRender()],
  }
}

export function unregister() {
  throw new Error('unregister not yet implemented')
}
