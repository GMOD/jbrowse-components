const loads = new Map<string, Promise<void>>()

/**
 * Loads a script once per `src`, however many callers ask at once. A failed
 * load takes its tag with it, so a later call tries again.
 */
export function loadScript(
  src: string,
  attributes: Record<string, string> = {},
) {
  let load = loads.get(src)
  if (!load) {
    const script = document.createElement('script')
    script.src = src
    for (const [key, value] of Object.entries(attributes)) {
      script.setAttribute(key, value)
    }
    load = new Promise<void>((resolve, reject) => {
      script.addEventListener('load', () => {
        resolve()
      })
      script.addEventListener('error', () => {
        loads.delete(src)
        script.remove()
        reject(new Error(`Failed to load ${src}`))
      })
    })
    loads.set(src, load)
    document.head.append(script)
  }
  return load
}
