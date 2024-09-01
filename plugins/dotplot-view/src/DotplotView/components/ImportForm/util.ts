export function getName(
  sessionTrackData?: { uri: string } | { localPath: string } | { name: string },
) {
  return sessionTrackData
    ? // @ts-expect-error
      sessionTrackData.uri ||
        // @ts-expect-error
        sessionTrackData.localPath ||
        // @ts-expect-error
        sessionTrackData.name
    : undefined
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
