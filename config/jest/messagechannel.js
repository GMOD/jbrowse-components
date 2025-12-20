if (typeof window !== 'undefined') {
  // message channel 'polyfill' that avoids open handles from making jest fail
  // https://github.com/facebook/react/issues/26608#issuecomment-1734172596
  const MessageChannelOriginal = require('worker_threads').MessageChannel
  global.MessageChannel = class {
    constructor() {
      const channel = new MessageChannelOriginal()
      this.port1 = new Proxy(channel.port1, {
        set(port1, prop, value) {
          const result = Reflect.set(port1, prop, value)
          if (prop === 'onmessage') {
            port1.unref()
          }
          return result
        },
      })
      this.port2 = channel.port2
    }
  }
}
