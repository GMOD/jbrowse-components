export function blobToDataURL(blob: Blob): Promise<string> {
  // Modern approach using URL.createObjectURL() and fetch()
  // However, for data URLs specifically, FileReader is still the standard approach
  // URL.createObjectURL() creates blob: URLs, not data: URLs

  // Alternative modern approach using async/await syntax
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read blob as data URL'))
    reader.readAsDataURL(blob)
  })
}
