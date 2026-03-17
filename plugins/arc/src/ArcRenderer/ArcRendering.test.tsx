import { ConfigurationSchema } from '@jbrowse/core/configuration'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { Jexl } from '@jbrowse/jexl'
import { render } from '@testing-library/react'

import Rendering from './ArcRendering.tsx'
import ArcRendererConfigSchema from './configSchema.ts'

function createJexl() {
  const j = new Jexl()
  j.addFunction(
    'get',
    (feature: { get: (k: string) => unknown }, data: string) =>
      feature.get(data),
  )
  j.addFunction('log10', Math.log10)
  j.addFunction(
    'logThickness',
    (feature: { get: (k: string) => unknown }, attr: string) =>
      Math.log((feature.get(attr) as number) + 1),
  )
  return j
}

function createArcConfig(overrides: Record<string, unknown> = {}) {
  return ArcRendererConfigSchema.create(
    { type: 'ArcRenderer', ...overrides },
    { pluginManager: { jexl: createJexl() } },
  )
}

test('no features', () => {
  const { container } = render(
    <Rendering
      exportSVG={false}
      height={400}
      displayModel={{ selectedFeatureId: 'none' }}
      onFeatureClick={() => {}}
      config={ConfigurationSchema('Test', {}).create()}
      regions={[
        { refName: 'zonk', start: 0, end: 300, assemblyName: 'volvox' },
      ]}
      bpPerPx={3}
      features={new Map()}
    />,
  )

  expect(container).toMatchSnapshot()
})

test('one feature', () => {
  const { container } = render(
    <Rendering
      exportSVG={false}
      height={400}
      config={ConfigurationSchema('Test', {}).create()}
      displayModel={{ selectedFeatureId: 'none' }}
      onFeatureClick={() => {}}
      regions={[
        { refName: 'zonk', start: 0, end: 1000, assemblyName: 'volvox' },
      ]}
      features={
        new Map([
          [
            'one',
            new SimpleFeature({
              refName: 't1',
              uniqueId: 'one',
              score: 10,
              start: 1,
              end: 3,
            }),
          ],
        ])
      }
      bpPerPx={3}
    />,
  )

  expect(container).toMatchSnapshot()
})

test('one semicircle', () => {
  const { container } = render(
    <Rendering
      exportSVG={false}
      height={400}
      config={ConfigurationSchema('Test', {
        displayMode: { type: 'string', defaultValue: 'semicircles' },
      }).create()}
      displayModel={{ selectedFeatureId: 'none' }}
      onFeatureClick={() => {}}
      regions={[
        { refName: 'zonk', start: 0, end: 1000, assemblyName: 'volvox' },
      ]}
      features={
        new Map([
          [
            'one',
            new SimpleFeature({
              refName: 't1',
              uniqueId: 'one',
              score: 10,
              start: 1,
              end: 3,
            }),
          ],
        ])
      }
      bpPerPx={3}
    />,
  )

  expect(container).toMatchSnapshot()
})

test('semicircle via displayMode prop', () => {
  const { container } = render(
    <Rendering
      exportSVG={false}
      height={400}
      config={ConfigurationSchema('Test', {}).create()}
      displayMode="semicircles"
      displayModel={{ selectedFeatureId: 'none' }}
      onFeatureClick={() => {}}
      regions={[
        { refName: 'zonk', start: 0, end: 1000, assemblyName: 'volvox' },
      ]}
      features={
        new Map([
          [
            'one',
            new SimpleFeature({
              refName: 't1',
              uniqueId: 'one',
              score: 10,
              start: 1,
              end: 3,
            }),
          ],
        ])
      }
      bpPerPx={3}
    />,
  )

  const path = container.querySelector('path')
  expect(path?.getAttribute('d')).toContain(' A ')
})

test('user-supplied jexl height expression produces valid arc paths (issue #5500)', () => {
  const config = createArcConfig({
    height: "jexl:log10(get(feature,'end')-get(feature,'start'))*20",
  })
  const { container } = render(
    <Rendering
      exportSVG={false}
      height={400}
      config={config}
      displayModel={{ selectedFeatureId: 'none' }}
      onFeatureClick={() => {}}
      regions={[
        { refName: 'zonk', start: 0, end: 1000, assemblyName: 'volvox' },
      ]}
      features={
        new Map([
          [
            'one',
            new SimpleFeature({
              refName: 't1',
              uniqueId: 'one',
              score: 10,
              start: 100,
              end: 500,
            }),
          ],
        ])
      }
      bpPerPx={3}
    />,
  )

  const path = container.querySelector('path')
  const d = path?.getAttribute('d') ?? ''
  expect(d).not.toContain('NaN')
  expect(d).toMatch(/^M .+ 0 C .+, .+, .+ 0$/)
})

test('default jexl height expression produces valid arc paths', () => {
  const config = createArcConfig()
  const { container } = render(
    <Rendering
      exportSVG={false}
      height={400}
      config={config}
      displayModel={{ selectedFeatureId: 'none' }}
      onFeatureClick={() => {}}
      regions={[
        { refName: 'zonk', start: 0, end: 1000, assemblyName: 'volvox' },
      ]}
      features={
        new Map([
          [
            'one',
            new SimpleFeature({
              refName: 't1',
              uniqueId: 'one',
              score: 10,
              start: 100,
              end: 500,
            }),
          ],
        ])
      }
      bpPerPx={3}
    />,
  )

  const path = container.querySelector('path')
  const d = path?.getAttribute('d') ?? ''
  expect(d).not.toContain('NaN')
  expect(d).toMatch(/^M .+ 0 C .+, .+, .+ 0$/)
})
