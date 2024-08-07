export function decodeURIComponentNoThrow(uri: string) {
  try {
    return decodeURIComponent(uri)
  } catch (e) {
    // avoid throwing exception on a failure to decode URI component
    return uri
  }
}
