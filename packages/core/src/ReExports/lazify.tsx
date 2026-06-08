import type React from 'react'
import { Suspense } from 'react'

function lazyifyComponent(
  key: string,
  ReactComponent: React.ComponentType<any>,
) {
  function Component(props: Record<string, unknown>) {
    return (
      <Suspense fallback={null}>
        <ReactComponent {...props} />
      </Suspense>
    )
  }
  Component.displayName = key
  return [key, Component]
}

export function lazyMap(
  obj: Record<string, React.ComponentType<any>>,
  prefix = '',
) {
  return Object.fromEntries(
    Object.entries(obj).map(([key, ReactComponent]) =>
      lazyifyComponent(`${prefix}${key}`, ReactComponent),
    ),
  )
}
