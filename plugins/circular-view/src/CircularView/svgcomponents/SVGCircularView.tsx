import { Fragment } from 'react'

import { wrapSvgExport } from '@jbrowse/core/svg/wrapSvgExport'
import { getSession, radToDeg } from '@jbrowse/core/util'
import { when } from 'mobx'

import Ruler from '../components/Ruler.tsx'

import type { CircularViewModel, ExportSvgOptions } from '../model.ts'

export async function renderToSvg(
  model: CircularViewModel,
  opts: ExportSvgOptions,
) {
  await when(() => model.initialized)
  const { themeName = 'default', Wrapper = ({ children }) => children } = opts
  const session = getSession(model)
  const theme = session.getActiveThemeOptions?.(themeName)

  const { figureSize } = model
  const tracks = [...model.tracks]
  const displayResults = await Promise.all(
    tracks.map(async track => ({
      track,
      result: await track.displays[0]!.renderSvg({ ...opts, theme }),
    })),
  )

  const { staticSlices, offsetRadians, centerXY } = model
  const deg = radToDeg(offsetRadians)

  // the xlink namespace is used for rendering <image> tag
  return wrapSvgExport({
    theme,
    width: figureSize,
    height: figureSize,
    margin: 0,
    Wrapper,
    children: (
      <g transform={`translate(${centerXY}) rotate(${deg})`}>
        {staticSlices.map(slice => (
          <Ruler key={slice.key} model={model} slice={slice} />
        ))}
        {displayResults.map(({ track, result }) => (
          <Fragment key={track.id}>{result}</Fragment>
        ))}
      </g>
    ),
  })
}
