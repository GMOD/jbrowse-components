import React from 'react'
import ReactPropTypes from 'prop-types'
import TestRenderer from 'react-test-renderer'
import Rendering, { featuresToSequence } from './DivSequenceRendering'
import PrecomputedLayout from '../../../util/layouts/PrecomputedLayout'
import SimpleFeature from '../../../util/simpleFeature'
import DivRenderingConfigSchema from '../configSchema'

test('features to sequence function', () => {
  expect(
    featuresToSequence(
      { start: 20, end: 30 },
      new Map([
        [
          'one',
          new SimpleFeature({
            uniqueId: 'foo',
            start: 10,
            end: 25,
            seq: '123456789012345',
          }),
        ],
      ]),
    ),
  ).toEqual('12345     ')
})

class ErrorCatcher extends React.Component {
  static propTypes = { children: ReactPropTypes.node.isRequired }

  constructor(props) {
    super(props)
    this.state = { hasError: false, errorText: '' }
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, errorText: String(error) }
  }

  render() {
    const { hasError, errorText } = this.state
    if (hasError) {
      // You can render any custom fallback UI
      return <h1 className="error">{errorText}</h1>
    }
    const { children } = this.props
    return children
  }
}

// these tests do very little, let's try to expand them at some point
test('no features', () => {
  const renderer = TestRenderer.create(
    <Rendering
      width={500}
      height={500}
      region={{ refName: 'zonk', start: 0, end: 300 }}
      layout={new PrecomputedLayout({ rectangles: {}, totalHeight: 20 })}
      config={DivRenderingConfigSchema.create()}
      bpPerPx={3}
    />,
  )
  const result = renderer.toJSON()

  expect(result).toMatchSnapshot()
})

test('one feature with no seq, zoomed way out', () => {
  const renderer = TestRenderer.create(
    <Rendering
      width={500}
      height={500}
      region={{ refName: 'zonk', start: 0, end: 1000 }}
      features={
        new Map([
          ['one', new SimpleFeature({ uniqueId: 'one', start: 1, end: 3 })],
        ])
      }
      config={DivRenderingConfigSchema.create({})}
      bpPerPx={3}
    />,
  )
  const result = renderer.toJSON()

  expect(result).toMatchSnapshot()
})

test('one feature with no seq, zoomed in, should throw', () => {
  const renderer = TestRenderer.create(
    <ErrorCatcher>
      <Rendering
        width={500}
        height={500}
        region={{ refName: 'zonk', start: 0, end: 1000 }}
        features={
          new Map([
            ['one', new SimpleFeature({ uniqueId: 'one', start: 1, end: 3 })],
          ])
        }
        config={DivRenderingConfigSchema.create({})}
        bpPerPx={0.05}
      />
    </ErrorCatcher>,
  )

  const result = renderer.toJSON()
  expect(result).toMatchSnapshot()
})

test('one feature with an incorrect seq, zoomed in, should throw', () => {
  const renderer = TestRenderer.create(
    <ErrorCatcher>
      <Rendering
        width={500}
        height={500}
        region={{ refName: 'zonk', start: 0, end: 1000 }}
        features={
          new Map([
            [
              'one',
              new SimpleFeature({
                uniqueId: 'one',
                start: 1,
                end: 3,
                seq: 'ABC',
              }),
            ],
          ])
        }
        config={DivRenderingConfigSchema.create({})}
        bpPerPx={0.05}
      />
    </ErrorCatcher>,
  )

  const result = renderer.toJSON()
  expect(result).toMatchSnapshot()
})

test('one feature with a correct seq, zoomed in, should render nicely', () => {
  const renderer = TestRenderer.create(
    <Rendering
      width={500}
      height={500}
      region={{ refName: 'zonk', start: 0, end: 1000 }}
      features={
        new Map([
          [
            'one',
            new SimpleFeature({
              uniqueId: 'one',
              start: 1,
              end: 10,
              seq: 'ABCDEFGHI',
            }),
          ],
        ])
      }
      config={DivRenderingConfigSchema.create({})}
      bpPerPx={0.05}
    />,
  )

  const result = renderer.toJSON()
  expect(result).toMatchSnapshot()
})
