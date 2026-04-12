export function resolve(uri: string, baseUri: string) {
  return new URL(uri, baseUri).href
}
