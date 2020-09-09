import GranularRectLayout from '@gmod/jbrowse-core/util/layouts/GranularRectLayout'
import PrecomputedLayout from '@gmod/jbrowse-core/util/layouts/PrecomputedLayout'
import SimpleFeature from '@gmod/jbrowse-core/util/simpleFeature'
import React from 'react'
import { render } from '@testing-library/react'
import SvgRendererConfigSchema from '../configSchema'
import Rendering from './SvgFeatureRendering'
import SvgOverlay from './SvgOverlay'

test('no features', () => {
  const { container } = render(
    <Rendering
      width={500}
      height={500}
      regions={[{ refName: 'zonk', start: 0, end: 300 }]}
      layout={new PrecomputedLayout({ rectangles: {}, totalHeight: 20 })}
      config={{}}
      bpPerPx={3}
    />,
  )

  expect(container.firstChild).toMatchSnapshot()
})

test('one feature', () => {
  const { container } = render(
    <Rendering
      width={500}
      height={500}
      regions={[{ refName: 'zonk', start: 0, end: 1000 }]}
      layout={new GranularRectLayout({ pitchX: 1, pitchY: 1 })}
      features={
        new Map([
          ['one', new SimpleFeature({ uniqueId: 'one', start: 1, end: 3 })],
        ])
      }
      config={SvgRendererConfigSchema.create({})}
      bpPerPx={3}
    />,
  )

  expect(container.firstChild).toMatchSnapshot()
})

test('one feature (compact mode)', () => {
  const config = SvgRendererConfigSchema.create({ displayMode: 'compact' })

  const { container } = render(
    <Rendering
      width={500}
      height={500}
      regions={[{ refName: 'zonk', start: 0, end: 1000 }]}
      layout={new GranularRectLayout({ pitchX: 1, pitchY: 1 })}
      features={
        new Map([
          [
            'one',
            new SimpleFeature({
              type: 'mRNA',
              start: 5975,
              end: 9744,
              score: 0.84,
              strand: 1,
              name: 'au9.g1002.t1',
              uniqueId: 'one',
              subfeatures: [
                {
                  type: 'five_prime_UTR',
                  start: 5975,
                  end: 6109,
                  score: 0.98,
                  strand: 1,
                },
                {
                  type: 'start_codon',
                  start: 6110,
                  end: 6112,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'CDS',
                  start: 6110,
                  end: 6148,
                  score: 1,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'CDS',
                  start: 6615,
                  end: 6683,
                  score: 1,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'CDS',
                  start: 6758,
                  end: 7040,
                  score: 1,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'CDS',
                  start: 7142,
                  end: 7319,
                  score: 1,
                  strand: 1,
                  phase: 2,
                },
                {
                  type: 'CDS',
                  start: 7411,
                  end: 7687,
                  score: 1,
                  strand: 1,
                  phase: 1,
                },
                {
                  type: 'CDS',
                  start: 7748,
                  end: 7850,
                  score: 1,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'CDS',
                  start: 7953,
                  end: 8098,
                  score: 1,
                  strand: 1,
                  phase: 2,
                },
                {
                  type: 'CDS',
                  start: 8166,
                  end: 8320,
                  score: 1,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'CDS',
                  start: 8419,
                  end: 8614,
                  score: 1,
                  strand: 1,
                  phase: 1,
                },
                {
                  type: 'CDS',
                  start: 8708,
                  end: 8811,
                  score: 1,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'CDS',
                  start: 8927,
                  end: 9239,
                  score: 1,
                  strand: 1,
                  phase: 1,
                },
                {
                  type: 'CDS',
                  start: 9414,
                  end: 9494,
                  score: 1,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'stop_codon',
                  start: 9492,
                  end: 9494,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'three_prime_UTR',
                  start: 9495,
                  end: 9744,
                  score: 0.86,
                  strand: 1,
                },
              ],
            }),
          ],
        ])
      }
      config={config}
      bpPerPx={3}
    />,
  )

  // reducedRepresentation of the transcript is just a box
  expect(container.firstChild).toMatchSnapshot()
})

test('processed transcript (reducedRepresentation mode)', () => {
  const config = SvgRendererConfigSchema.create({
    displayMode: 'reducedRepresentation',
  })
  const { container } = render(
    <Rendering
      width={500}
      height={500}
      regions={[{ refName: 'zonk', start: 0, end: 1000 }]}
      layout={new GranularRectLayout({ pitchX: 1, pitchY: 1 })}
      features={
        new Map([
          ['one', new SimpleFeature({ uniqueId: 'one', start: 1, end: 3 })],
        ])
      }
      config={config}
      bpPerPx={3}
    />,
  )

  expect(container.firstChild).toMatchSnapshot()
})

test('processed transcript', () => {
  const { container } = render(
    <Rendering
      width={500}
      height={500}
      regions={[{ refName: 'zonk', start: 0, end: 1000 }]}
      layout={new GranularRectLayout({ pitchX: 1, pitchY: 1 })}
      features={
        new Map([
          [
            'one',
            new SimpleFeature({
              type: 'mRNA',
              start: 5975,
              end: 9744,
              score: 0.84,
              strand: 1,
              name: 'au9.g1002.t1',
              uniqueId: 'one',
              subfeatures: [
                {
                  type: 'five_prime_UTR',
                  start: 5975,
                  end: 6109,
                  score: 0.98,
                  strand: 1,
                },
                {
                  type: 'start_codon',
                  start: 6110,
                  end: 6112,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'CDS',
                  start: 6110,
                  end: 6148,
                  score: 1,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'CDS',
                  start: 6615,
                  end: 6683,
                  score: 1,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'CDS',
                  start: 6758,
                  end: 7040,
                  score: 1,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'CDS',
                  start: 7142,
                  end: 7319,
                  score: 1,
                  strand: 1,
                  phase: 2,
                },
                {
                  type: 'CDS',
                  start: 7411,
                  end: 7687,
                  score: 1,
                  strand: 1,
                  phase: 1,
                },
                {
                  type: 'CDS',
                  start: 7748,
                  end: 7850,
                  score: 1,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'CDS',
                  start: 7953,
                  end: 8098,
                  score: 1,
                  strand: 1,
                  phase: 2,
                },
                {
                  type: 'CDS',
                  start: 8166,
                  end: 8320,
                  score: 1,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'CDS',
                  start: 8419,
                  end: 8614,
                  score: 1,
                  strand: 1,
                  phase: 1,
                },
                {
                  type: 'CDS',
                  start: 8708,
                  end: 8811,
                  score: 1,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'CDS',
                  start: 8927,
                  end: 9239,
                  score: 1,
                  strand: 1,
                  phase: 1,
                },
                {
                  type: 'CDS',
                  start: 9414,
                  end: 9494,
                  score: 1,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'stop_codon',
                  start: 9492,
                  end: 9494,
                  strand: 1,
                  phase: 0,
                },
                {
                  type: 'three_prime_UTR',
                  start: 9495,
                  end: 9744,
                  score: 0.86,
                  strand: 1,
                },
              ],
            }),
          ],
        ])
      }
      config={SvgRendererConfigSchema.create({})}
      bpPerPx={3}
    />,
  )

  expect(container.firstChild).toMatchSnapshot()
})

test('svg selected', () => {
  const blockLayoutFeatures = new Map()
  const layout = new Map()
  layout.set('one', [0, 0, 10, 10])
  blockLayoutFeatures.set('block1', layout)

  const { container } = render(
    <svg>
      <SvgOverlay
        width={500}
        height={500}
        blockKey="block1"
        region={{ refName: 'zonk', start: 0, end: 1000 }}
        trackModel={{
          blockLayoutFeatures,
          featureIdUnderMouse: 'one',
          selectedFeatureId: 'one',
        }}
        config={SvgRendererConfigSchema.create({})}
        bpPerPx={3}
      />
    </svg>,
  )

  expect(container.firstChild).toMatchSnapshot()
})
