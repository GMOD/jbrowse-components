import { Suspense, forwardRef } from 'react'

export function lazyifyComponent(key: string, ReactComponent: any) {
  const Component = forwardRef((props: any, ref) => (
    <Suspense fallback={null}>
      <ReactComponent {...props} ref={ref} />
    </Suspense>
  ))
  Component.displayName = key
  return [key, Component]
}

export function lazyMap(obj: Record<string, React.FC<any>>, prefix = '') {
  return Object.fromEntries(
    Object.entries(obj).map(([key, ReactComponent]) =>
      lazyifyComponent(`${prefix}${key}`, ReactComponent),
    ),
  )
}
