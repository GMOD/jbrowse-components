import { render } from '@testing-library/react'
import { DockviewReact } from 'dockview-react'

// The error only reaches a consumer through DockviewReact: it is the thing that
// puts `createContextMenuItemComponent` into the core options, and core reports
// the option as declared intent for a module that ships in dockview-enterprise.
// A bare createDockview never sets it, so testing that proves nothing.
test('mounting DockviewReact reports no missing enterprise module', () => {
  const errors: string[] = []
  const orig = console.error
  console.error = (...args: unknown[]) => {
    errors.push(String(args))
  }
  try {
    render(
      <DockviewReact
        components={{ x: () => <div /> }}
        onReady={e => {
          e.api.addPanel({ id: 'p1', component: 'x' })
        }}
      />,
    )
  } finally {
    console.error = orig
  }
  expect(errors.filter(e => e.includes('dockview-enterprise'))).toEqual([])
})
