export function loadScript(
  src: string,
  attributes: Record<string, string> = {},
) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    for (const [key, value] of Object.entries(attributes)) {
      script.setAttribute(key, value)
    }
    script.addEventListener('load', () => {
      resolve()
    })
    script.addEventListener('error', () => {
      reject(new Error(`Failed to load ${src}`))
    })
    document.head.append(script)
  })
}
