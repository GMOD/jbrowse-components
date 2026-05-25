import type React from 'react'
import { Suspense, forwardRef } from 'react'

export function lazyifyComponent(
  key: string,
  ReactComponent: React.ComponentType<any>,
) {
  const Component = forwardRef((props: Record<string, unknown>, ref) => (
    <Suspense fallback={null}>
      <ReactComponent {...props} ref={ref} />
    </Suspense>
  ))
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
