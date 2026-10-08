// The config a release's JSON schema admits, as one line per slot path
// (`LinearWiggleDisplay.scales.y.domainMin`) and one per enum member
// (`LinearWiggleDisplay.mark=bar`). A retired key or a legacy enum value is a
// deprecated property or branch of the schema, so it keeps its line; a slot
// deleted without a `retired` entry loses it, which is what
// check-config-slot-paths.ts refuses.
//
// The session half is the keys an author writes by hand: the session's own,
// and each view's launch keys with the legacy spellings it still converts.
// View and display state stay out, since the app writes those.
type JsonSchema = Record<string, unknown>

const SESSION_KEYS = new Set(['defaultSession', 'preConfiguredSessions'])
const BRANCHES = ['allOf', 'anyOf', 'oneOf']

const isSchema = (value: unknown): value is JsonSchema =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const refName = (schema: JsonSchema) =>
  typeof schema.$ref === 'string'
    ? schema.$ref.replace('#/$defs/', '')
    : undefined

function discriminator(schema: JsonSchema) {
  const condition = schema.if
  const properties = isSchema(condition) ? condition.properties : undefined
  const type = isSchema(properties) ? properties.type : undefined
  return isSchema(type) && typeof type.const === 'string'
    ? type.const
    : undefined
}

export function slotPaths(schema: JsonSchema) {
  const defs = isSchema(schema.$defs) ? schema.$defs : {}
  // a registered type is listed under its own name, so a path stops at one
  const registered = new Set(
    Object.keys(defs).filter(name => `${name}Slots` in defs),
  )
  const paths = new Set<string>()

  function walk(node: unknown, path: string, inside: readonly string[]) {
    if (!isSchema(node)) {
      return
    }
    const target = refName(node)
    if (target && !registered.has(target) && !inside.includes(target)) {
      walk(defs[target], path, [...inside, target])
    }
    if (Array.isArray(node.enum)) {
      for (const member of node.enum) {
        paths.add(`${path}=${String(member)}`)
      }
    }
    if (isSchema(node.properties)) {
      for (const [key, value] of Object.entries(node.properties)) {
        paths.add(`${path}.${key}`)
        walk(value, `${path}.${key}`, inside)
      }
    }
    walk(node.items, `${path}[]`, inside)
    walk(node.additionalProperties, `${path}{}`, inside)
    for (const key of BRANCHES) {
      const branches = node[key]
      if (Array.isArray(branches)) {
        for (const branch of branches) {
          walk(branch, path, inside)
        }
      }
    }
    // a union dispatches on `type`, and two members may share a slot name
    const member = discriminator(node)
    walk(node.then, member ? `${path}<${member}>` : path, inside)
    walk(node.else, path, inside)
  }

  for (const name of registered) {
    walk(defs[name], name, [name])
  }
  const { properties = {}, ...rest } = schema
  walk(rest, 'config', [])
  for (const [key, value] of Object.entries(properties as JsonSchema)) {
    if (!SESSION_KEYS.has(key)) {
      paths.add(`config.${key}`)
      walk(value, `config.${key}`, [])
    }
  }
  return [...paths].sort()
}

interface ViewKeys {
  launchKeys: string[]
  passThrough?: string[]
}

export function sessionKeyPaths(
  schema: JsonSchema,
  views: Record<string, ViewKeys>,
) {
  const defs = isSchema(schema.$defs) ? schema.$defs : {}
  const session = isSchema(defs.Session) ? defs.Session.properties : undefined
  return [
    ...Object.keys(isSchema(session) ? session : {}).map(
      key => `Session.${key}`,
    ),
    ...Object.entries(views).flatMap(([view, keys]) =>
      [...keys.launchKeys, ...(keys.passThrough ?? [])].map(
        key => `${view}.${key}`,
      ),
    ),
  ].sort()
}
