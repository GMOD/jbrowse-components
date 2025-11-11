export function blobToDataURL(blob: Blob): Promise<string> {
  const a = new FileReader()
  return new Promise((resolve, reject) => {
    a.onload = e => {
      if (e.target) {
        resolve(e.target.result as string)
      } else {
        reject(new Error('unknown result reading blob from canvas'))
      }
    }
    a.readAsDataURL(blob)
  })
}
