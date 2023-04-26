import { max, measureText } from '../../util'
import { ellipses } from '../util'

export function isEmpty(obj: Record<string, unknown>) {
  return Object.keys(obj).length === 0
}

export function generateTitle(name: unknown, id: unknown, type: unknown) {
  return [ellipses(`${name}` || `${id}`), `${type}`]
    .filter(f => !!f)
    .join(' - ')
}

export function generateMaxWidth(array: unknown[][], prefix: string[]) {
  return (
    Math.ceil(
      max(array.map(key => measureText([...prefix, key[0]].join('.'), 12))),
    ) + 10
  )
}

export function toLocale(n: number) {
  return n.toLocaleString('en-US')
}
