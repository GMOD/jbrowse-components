import '@testing-library/jest-dom/extend-expect'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import { render } from '@testing-library/react'
import Base1DView from '@gmod/jbrowse-core/util/Base1DViewModel'
import React from 'react'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import LinearSyntenyRendering from './LinearSyntenyRendering'
import { configSchemaFactory } from '../../LinearSyntenyTrack'
import ThisPlugin from '../..'

expect.extend({ toMatchImageSnapshot })

// these tests do very little, let's try to expand them at some point
test('test rendering a simple synteny from fake data', async () => {
  const pluginManager = new PluginManager([new ThisPlugin()])
  const configSchema = configSchemaFactory(pluginManager)
  const views = [
    Base1DView.create({
      offsetPx: 0,
      bpPerPx: 1,

      displayedRegions: [
        { assemblyName: 'hg38', refName: 'chr1', start: 0, end: 999 },
      ],
    }),
    Base1DView.create({
      offsetPx: 0,
      bpPerPx: 1,

      displayedRegions: [
        { assemblyName: 'mm10', refName: 'chr1', start: 0, end: 999 },
      ],
    }),
  ]
  render(
    <LinearSyntenyRendering
      width={800}
      height={600}
      trackModel={{
        trackId: 'test',
        configuration: configSchema.create({
          trackId: 'test',
          renderer: { color: 'rgba(255,100,100,0.3)' },
        }),
      }}
      highResolutionScaling={1}
      trackIds={['peach_gene', 'grape_gene']}
      views={views}
    />,
  )

  //   const data = r.src.replace(/^data:image\/\w+;base64,/, '')
  //   const buf = Buffer.from(data, 'base64')
  //   // this is needed to do a fuzzy image comparison because
  //   // the travis-ci was 2 pixels different for some reason, see PR #710
  //   // @ts-ignore
  //   expect(buf).toMatchImageSnapshot()
})
