export function setupWebGLContextLossHandler(
  canvas: HTMLCanvasElement,
  onRestore: () => void,
) {
  const handleContextLost = (e: Event) => {
    e.preventDefault()
  }
  const handleContextRestored = () => {
    onRestore()
  }
  canvas.addEventListener('webglcontextlost', handleContextLost)
  canvas.addEventListener('webglcontextrestored', handleContextRestored)
  return () => {
    canvas.removeEventListener('webglcontextlost', handleContextLost)
    canvas.removeEventListener('webglcontextrestored', handleContextRestored)
  }
}
