import React from 'react'
import { render } from '@testing-library/react'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import DivSequenceRendering from './DivSequenceRendering'
import DivRenderingConfigSchema from '../configSchema'

// This just keeps our testing logs clean by not displaying `console.error`s
// from errors we intentionally throw in our tests. Hopefully React will
// someday provide a way for error boundaries to prevent error logging so we
// won't have to do this: https://github.com/facebook/react/issues/15069
const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (
      args[0].includes('feature one did not contain a valid `seq` attribute') ||
      args[0].includes(
        'The above error occurred in the <SequenceDivs> component',
      )
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})

test('renders with one, zoomed way out', () => {
  const { container } = render(
    <DivSequenceRendering
      regions={[
        { assemblyName: 'volvox', refName: 'zonk', start: 0, end: 1000 },
      ]}
      features={
        new Map([
          [
            'one',
            new SimpleFeature({
              uniqueId: 'one',
              start: 1,
              end: 3,
              seq: 'AB',
            }),
          ],
        ])
      }
      config={DivRenderingConfigSchema.create({})}
      bpPerPx={3}
    />,
  )

  expect(container).toMatchSnapshot()
})

test('renders with one feature with no seq, zoomed in, should throw', () => {
  const { container } = render(
    <DivSequenceRendering
      regions={[
        { assemblyName: 'volvox', refName: 'zonk', start: 0, end: 1000 },
      ]}
      features={
        new Map([
          ['one', new SimpleFeature({ uniqueId: 'one', start: 1, end: 3 })],
        ])
      }
      config={DivRenderingConfigSchema.create({})}
      bpPerPx={0.05}
    />,
  )

  expect(container).toMatchSnapshot()
})

test('renders with one feature with an incorrect seq, zoomed in, should throw', () => {
  const { container } = render(
    <DivSequenceRendering
      regions={[
        { assemblyName: 'volvox', refName: 'zonk', start: 0, end: 1000 },
      ]}
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
    />,
  )

  expect(container).toMatchSnapshot()
})

test('renders with one feature with a correct seq, zoomed in, should render nicely', () => {
  const { container } = render(
    <DivSequenceRendering
      regions={[
        { assemblyName: 'volvox', refName: 'zonk', start: 0, end: 1000 },
      ]}
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

  expect(container).toMatchSnapshot()
})

test('renders with one feature reversed with a correct seq, zoomed in, should render nicely', () => {
  const { container } = render(
    <DivSequenceRendering
      regions={[
        {
          assemblyName: 'volvox',
          refName: 'zonk',
          start: 0,
          end: 1000,
          reversed: true,
        },
      ]}
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

  expect(container).toMatchSnapshot()
})
