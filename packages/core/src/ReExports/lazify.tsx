import { Suspense } from 'react'

import type React from 'react'

// React tags the result of React.lazy() with this; anything else (a plain or
// forwardRef/memo component) is already loaded and needs no Suspense boundary
const REACT_LAZY_TYPE = Symbol.for('react.lazy')

function isLazy(component: React.ComponentType<any>) {
  return (component as { $$typeof?: symbol }).$$typeof === REACT_LAZY_TYPE
}

function lazyifyComponent(
  key: string,
  ReactComponent: React.ComponentType<any>,
) {
  // eager entries pass through untouched — wrapping them in Suspense would only
  // reintroduce the overlay-misposition bug (see Entries)
  if (!isLazy(ReactComponent)) {
    return [key, ReactComponent]
  }
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
