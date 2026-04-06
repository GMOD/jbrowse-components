global.ResizeObserver = class ResizeObserver {
  constructor(cb) {
    this._cb = cb
  }
  observe(el) {
    this._cb([
      {
        contentBoxSize: [
          {
            inlineSize: el.clientWidth || 800,
            blockSize: el.clientHeight || 600,
          },
        ],
        contentRect: {
          width: el.clientWidth || 800,
          height: el.clientHeight || 600,
        },
      },
    ])
  }
  unobserve() {}
  disconnect() {}
}
