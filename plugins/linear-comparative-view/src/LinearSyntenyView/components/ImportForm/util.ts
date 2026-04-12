export function getName(
  sessionTrackData?: { uri: string } | { localPath: string } | { name: string },
) {
  if (!sessionTrackData) {
    return undefined
  }
  if ('uri' in sessionTrackData) {
    return sessionTrackData.uri
  }
  if ('localPath' in sessionTrackData) {
    return sessionTrackData.localPath
  }
  return sessionTrackData.name
}

export function stripGz(fileName: string) {
  return fileName.endsWith('.gz') ? fileName.slice(0, -3) : fileName
}

export function basename(str: string) {
  return str.split('#')[0]!.split('?')[0]!.split('/').pop()
}

export function extName(str: string) {
  const r = str.split('.').pop()
  return r ? `.${r}` : ''
}
