export function stripGz(fileName: string) {
  return fileName.endsWith('.gz') ? fileName.slice(0, -3) : fileName
}
