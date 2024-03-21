import React from 'react'
import { render } from '@testing-library/react'
import { SimpleFeature } from '@jbrowse/core/util'
import DivSequenceRendering from './DivSequenceRendering'
import DivRenderingConfigSchema from '../configSchema'

test('renders with one, zoomed way out', () => {
  const { container } = render(
    <DivSequenceRendering
      regions={[
        { assemblyName: 'volvox', end: 1000, refName: 'zonk', start: 0 },
      ]}
      colorByCDS={false}
      features={
        new Map([
          [
            'one',
            new SimpleFeature({
              end: 3,
              seq: 'AB',
              start: 1,
              uniqueId: 'one',
            }),
          ],
        ])
      }
      config={DivRenderingConfigSchema.create({})}
      bpPerPx={3}
      sequenceHeight={160}
      rowHeight={20}
    />,
  )

  expect(container).toMatchSnapshot()
})

test('renders with one feature with no seq, zoomed in, should throw', () => {
  const { container } = render(
    <DivSequenceRendering
      regions={[
        { assemblyName: 'volvox', end: 1000, refName: 'zonk', start: 0 },
      ]}
      colorByCDS={false}
      features={
        new Map([
          ['one', new SimpleFeature({ end: 3, start: 1, uniqueId: 'one' })],
        ])
      }
      config={DivRenderingConfigSchema.create({})}
      bpPerPx={0.05}
      sequenceHeight={160}
      rowHeight={20}
    />,
  )

  expect(container).toMatchSnapshot()
})

test('renders with one feature with an incorrect seq, zoomed in, should throw', () => {
  const { container } = render(
    <DivSequenceRendering
      regions={[
        { assemblyName: 'volvox', end: 1000, refName: 'zonk', start: 0 },
      ]}
      colorByCDS={false}
      features={
        new Map([
          [
            'one',
            new SimpleFeature({
              end: 3,
              seq: 'ABC',
              start: 1,
              uniqueId: 'one',
            }),
          ],
        ])
      }
      config={DivRenderingConfigSchema.create({})}
      bpPerPx={0.05}
      sequenceHeight={160}
      rowHeight={20}
    />,
  )

  expect(container).toMatchSnapshot()
})

test('renders with one feature with a correct seq, zoomed in, should render nicely', () => {
  const { container } = render(
    <DivSequenceRendering
      regions={[
        { assemblyName: 'volvox', end: 1000, refName: 'zonk', start: 0 },
      ]}
      colorByCDS={false}
      features={
        new Map([
          [
            'one',
            new SimpleFeature({
              end: 10,
              seq: 'ABCDEFGHI',
              start: 1,
              uniqueId: 'one',
            }),
          ],
        ])
      }
      config={DivRenderingConfigSchema.create({})}
      bpPerPx={0.05}
      sequenceHeight={160}
      rowHeight={20}
    />,
  )

  expect(container).toMatchSnapshot()
})

test('renders with one feature reversed with a correct seq, zoomed in, should render nicely', () => {
  const { container } = render(
    <DivSequenceRendering
      regions={[
        {
          assemblyName: 'volvox',
          end: 1000,
          refName: 'zonk',
          reversed: true,
          start: 0,
        },
      ]}
      colorByCDS={false}
      features={
        new Map([
          [
            'one',
            new SimpleFeature({
              end: 10,
              seq: 'ABCDEFGHI',
              start: 1,
              uniqueId: 'one',
            }),
          ],
        ])
      }
      config={DivRenderingConfigSchema.create({})}
      bpPerPx={0.05}
      sequenceHeight={160}
      rowHeight={20}
    />,
  )

  expect(container).toMatchSnapshot()
})
