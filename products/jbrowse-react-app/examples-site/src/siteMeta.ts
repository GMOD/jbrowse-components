// The stylesheet every consumer of the published package imports. It is empty
// today, and imported here so the demos pick up whatever it ships next.
import '@jbrowse/react-app2/styles.css'

// per-site chrome config consumed by the shared Shell layout. The full app demo
// needs the whole content width, so this site doesn't cap main.
export const componentLabel = 'React App'
export const mainMaxWidth = 'none'
// the full app demo needs a fixed-height, clipped viewport
export const demoFillHeight = true
// `demoFillHeight` already gives every demo box its height, so none is reserved
export const demoHeights: Record<string, number> = {}
