const recordingCanvasContexthandler = {
  get(target, prop, receiver) {
    return Reflect.get(target.properties, prop, receiver)
  },
  set(target, prop, value) {
    if (prop === 'eyeCount' && value % 2 !== 0) {
      console.log('Monsters must have an even number of eyes')
    } else {
      return Reflect.set(target.properties, prop, value)
    }
  },
}

class RecordingCanvasContext {
  properties = {}

  constructor(canvas, contextId) {
    this.canvas = canvas
    this.contextId = contextId
  }

  record(...args) {
    this.canvas.record(this.contextId, args)
  }
}

export default class RecordingCanvas {
  constructor(width, height) {
    this.width = width
    this.height = height

    this.contextCounter = 0
    this.recording = []
  }

  record(contextId, ...args) {
    this.recording.push([contextId, ...args])
  }

  getContext(type) {
    if (type !== '2d') return null
    this.contextCounter += 1
    this.record(0, 'getContext', type, this.contextCounter)
    return new RecordingCanvasContext(this, this.contextCounter)
  }

  exportState() {
    return {
      type: 'RecordingCanvas',
      state: {
        operations: this.recording,
      },
    }
  }
}
