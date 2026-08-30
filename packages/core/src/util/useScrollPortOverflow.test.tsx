import { useRef } from 'react'

import { render } from '@testing-library/react'

import { useScrollPortOverflow } from './hooks.ts'

// jsdom lays nothing out, so both sides of the comparison have to be dictated:
// the measured content's height and the port's visible height.
function Fixture({
  contentHeight,
  portHeight,
}: {
  contentHeight: number
  portHeight: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const overflowing = useScrollPortOverflow(ref)
  return (
    <div
      style={{ overflowY: 'auto' }}
      ref={node => {
        if (node) {
          Object.defineProperty(node, 'clientHeight', {
            value: portHeight,
            configurable: true,
          })
        }
      }}
    >
      <div
        ref={node => {
          ref.current = node
          if (node) {
            node.getBoundingClientRect = () =>
              ({ height: contentHeight }) as DOMRect
          }
        }}
        data-testid="content"
        data-overflowing={overflowing}
      />
    </div>
  )
}

test('content taller than the port is scrollable', () => {
  const { getByTestId } = render(
    <Fixture contentHeight={900} portHeight={800} />,
  )
  expect(getByTestId('content').dataset.overflowing).toBe('true')
})

test('content shorter than the port is not', () => {
  const { getByTestId } = render(
    <Fixture contentHeight={400} portHeight={800} />,
  )
  expect(getByTestId('content').dataset.overflowing).toBe('false')
})
