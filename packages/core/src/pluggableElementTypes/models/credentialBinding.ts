function sortKeysDeep(value: unknown): unknown {
  return Array.isArray(value)
    ? value.map(sortKeysDeep)
    : value !== null && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([key, member]) => [key, sortKeysDeep(member)]),
        )
      : value
}

export function canonicalJson(value: unknown) {
  return JSON.stringify(sortKeysDeep(value))
}

const unboundSlots = new Set(['name', 'description'])

export function credentialBinding(config: object) {
  return canonicalJson(
    Object.fromEntries(
      Object.entries(config).filter(([key]) => !unboundSlots.has(key)),
    ),
  )
}

export function bindCredential(token: string, binding: string) {
  return JSON.stringify({ token, binding })
}

function parseStored(stored: string): unknown {
  try {
    return JSON.parse(stored)
  } catch {
    return undefined
  }
}

export function unbindCredential(stored: string | undefined, binding: string) {
  const parsed = stored ? parseStored(stored) : undefined
  return typeof parsed === 'object' &&
    parsed !== null &&
    'binding' in parsed &&
    'token' in parsed &&
    parsed.binding === binding &&
    typeof parsed.token === 'string'
    ? parsed.token
    : undefined
}
