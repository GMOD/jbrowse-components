import React from 'react'
import ReactPropTypes from 'prop-types'
import { render } from '@testing-library/react'
import PrecomputedLayout from '@gmod/jbrowse-core/util/layouts/PrecomputedLayout'
import SimpleFeature from '@gmod/jbrowse-core/util/simpleFeature'
import Rendering, { featuresToSequence } from './DivSequenceRendering'
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

describe('<DivSequenceRendering />', () => {
  // this is just a little hack to silence a warning that we'll get until react
  // fixes this: https://github.com/facebook/react/pull/14853
  const originalError = console.error
  beforeAll(() => {
    console.error = (...args) => {
      if (/feature one did not contain a valid `seq` attribute/.test(args[0])) {
        return
      }
      originalError.call(console, ...args)
    }
  })

  afterAll(() => {
    console.error = originalError
  })

  // these tests do very little, let's try to expand them at some point
  it('renders with no features', () => {
    const { container } = render(
      <Rendering
        width={500}
        height={500}
        region={{ refName: 'zonk', start: 0, end: 300 }}
        layout={new PrecomputedLayout({ rectangles: {}, totalHeight: 20 })}
        config={DivRenderingConfigSchema.create()}
        bpPerPx={3}
      />,
    )

    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders with one feature with no seq, zoomed way out', () => {
    const { container } = render(
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

    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders with one feature with no seq, zoomed in, should throw', () => {
    const { container } = render(
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

    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders with one feature with an incorrect seq, zoomed in, should throw', () => {
    const { container } = render(
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

    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders with one feature with a correct seq, zoomed in, should render nicely', () => {
    const { container } = render(
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

    expect(container.firstChild).toMatchSnapshot()
  })
})
