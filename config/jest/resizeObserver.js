class MyResizeObserver {
  constructor(callback) {
    this.callback = callback
  }

  observe(target) {
    setTimeout(() => this.callback([{ target }]), 0)
  }

  unobserve() {}

  disconnect() {}
}

if (typeof window !== 'undefined') {
  window.ResizeObserver = MyResizeObserver
}
