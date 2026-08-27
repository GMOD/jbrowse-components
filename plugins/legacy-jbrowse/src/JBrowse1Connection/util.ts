import getValue from './get-value.ts'

import type { Track } from './types.ts'

export function isTrack(arg: unknown): arg is Track {
  const a = arg as Track | undefined
  return !!a?.label && typeof a.label === 'string'
}

/**
 * replace variables in a template string with values
 *
 * @param template - String with variable names in curly brackets
 * e.g., `http://foo/{bar}?arg={baz.foo}`
 * @param fillWith - object with attribute-value mappings
 * e.g., `{ 'bar': 'someurl', 'baz': { 'foo': 42 } }`
 * @returns the template string with variables in fillWith replaced
 * e.g., 'htp://foo/someurl?arg=valueforbaz'
 */
export function fillTemplate(
  template: string,
  fillWith: Record<string, unknown>,
): string {
  return template.replaceAll(/{([\s\w.]+)}/g, (match, varName) => {
    const fill = getValue(fillWith, varName.replaceAll(/\s+/g, ''))
    return fill === undefined ? match : `${fill}`
  })
}
