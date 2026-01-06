import { createJBrowseTheme } from '@jbrowse/core/ui/theme'
import { SimpleFeature } from '@jbrowse/core/util'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import DivSequenceRendering from './DivSequenceRendering.tsx'
import DivRenderingConfigSchema from '../configSchema.ts'

function Base({ children }: { children: React.ReactNode }) {
  return <ThemeProvider theme={createJBrowseTheme()}>{children}</ThemeProvider>
}
test('renders with one, zoomed way out', () => {
  const { container } = render(
    <Base>
      <DivSequenceRendering
        regions={[
          { assemblyName: 'volvox', refName: 'zonk', start: 0, end: 1000 },
        ]}
        colorByCDS={false}
        features={
          new Map([
            [
              'one',
              new SimpleFeature({
                uniqueId: 'one',
                refName: 't1',
                start: 1,
                end: 3,
                seq: 'AB',
              }),
            ],
          ])
        }
        config={DivRenderingConfigSchema.create({})}
        bpPerPx={3}
        sequenceHeight={160}
        rowHeight={20}
      />
    </Base>,
  )

  expect(container).toMatchSnapshot()
})

test('renders with one feature with no seq, zoomed in, should throw', () => {
  const { container } = render(
    <DivSequenceRendering
      regions={[
        { assemblyName: 'volvox', refName: 'zonk', start: 0, end: 1000 },
      ]}
      colorByCDS={false}
      features={
        new Map([
          [
            'one',
            new SimpleFeature({
              uniqueId: 'one',
              refName: 't1',
              start: 1,
              end: 3,
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

test('renders with one feature with an incorrect seq, zoomed in, should throw', () => {
  const { container } = render(
    <Base>
      <DivSequenceRendering
        regions={[
          { assemblyName: 'volvox', refName: 'zonk', start: 0, end: 1000 },
        ]}
        colorByCDS={false}
        features={
          new Map([
            [
              'one',
              new SimpleFeature({
                refName: 't1',
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
        sequenceHeight={160}
        rowHeight={20}
      />
    </Base>,
  )

  expect(container).toMatchSnapshot()
})

test('renders with one feature with a correct seq, zoomed in, should render nicely', () => {
  const { container } = render(
    <Base>
      <DivSequenceRendering
        regions={[
          { assemblyName: 'volvox', refName: 'zonk', start: 0, end: 1000 },
        ]}
        colorByCDS={false}
        features={
          new Map([
            [
              'one',
              new SimpleFeature({
                refName: 't1',
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
        sequenceHeight={160}
        rowHeight={20}
      />
    </Base>,
  )

  expect(container).toMatchSnapshot()
})

test('renders with one feature reversed with a correct seq, zoomed in, should render nicely', () => {
  const { container } = render(
    <Base>
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
        colorByCDS={false}
        features={
          new Map([
            [
              'one',
              new SimpleFeature({
                refName: 't1',
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
        sequenceHeight={160}
        rowHeight={20}
      />
    </Base>,
  )

  expect(container).toMatchSnapshot()
})
