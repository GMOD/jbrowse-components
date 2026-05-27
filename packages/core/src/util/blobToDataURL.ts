export function blobToDataURL(blob: Blob): Promise<string> {
  const a = new FileReader()
  return new Promise((resolve, reject) => {
    a.onload = () => {
      if (typeof a.result === 'string') {
        resolve(a.result)
      } else {
        reject(new Error('unknown result reading blob from canvas'))
      }
    }
    a.onerror = () => {
      reject(a.error ?? new Error('FileReader failed reading blob'))
    }
    a.readAsDataURL(blob)
  })
}
