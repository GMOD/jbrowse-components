export function trackTypeShortName(displayName: string) {
  return displayName.replace(/ track$/i, '')
}

export function getRootKeys(obj: Record<string, unknown>) {
  return Object.keys(obj).filter(key => {
    const val = obj[key]
    return val !== null && val !== undefined && typeof val !== 'object'
  })
}
