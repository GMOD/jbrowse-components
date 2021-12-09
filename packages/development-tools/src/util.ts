import path from 'path'

export function safePackageName(name: string) {
  return name
    .toLowerCase()
    .replace(/(^@.*\/)|((^[^a-zA-Z]+)|[^\w.-])|([^a-zA-Z0-9]+$)/g, '')
}

export function external(id: string) {
  if (id.startsWith('regenerator-runtime')) {
    return false
  }
  return !id.startsWith('.') && !path.isAbsolute(id)
}
