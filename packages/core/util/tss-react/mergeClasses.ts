import type { Cx } from './types'

export function mergeClasses<T extends string, U extends string>(
  classesFromUseStyles: Record<T, string>,
  classesOverrides: Partial<Record<U, string>> | undefined,
  cx: Cx,
): Record<T, string> & Partial<Record<Exclude<U, T>, string>> {
  if (!(classesOverrides instanceof Object)) {
    return classesFromUseStyles as Record<T, string> &
      Partial<Record<Exclude<U, T>, string>>
  }

  const overrideKeys = Object.keys(classesOverrides)
  if (overrideKeys.length === 0) {
    return classesFromUseStyles as Record<T, string> &
      Partial<Record<Exclude<U, T>, string>>
  }

  const out: Record<string, string> = {}

  for (const ruleName of Object.keys(classesFromUseStyles)) {
    out[ruleName] = cx(
      classesFromUseStyles[ruleName as T],
      classesOverrides[ruleName as U],
    )
  }

  for (const ruleName of overrideKeys) {
    if (ruleName in classesFromUseStyles) {
      continue
    }

    const className = classesOverrides[ruleName as U]

    if (typeof className !== 'string') {
      continue
    }

    out[ruleName] = className
  }

  return out as Record<T, string> & Partial<Record<Exclude<U, T>, string>>
}
