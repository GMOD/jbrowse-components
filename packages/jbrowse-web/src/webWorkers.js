import RenderWorker from './render.worker'

function registerRender() {
  const renderWorker = new RenderWorker()
  return renderWorker
}

export function register() {
  // we can't do more than 1 render worker right
  // now because of caches, layout, and sessions
  // in order to do it, we would need to implement shared state
  return {
    // hello: [registerHello()],
    render: [registerRender()],
  }
}

export function unregister() {
  throw new Error('unregister not yet implemented')
}
