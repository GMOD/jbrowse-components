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
  const { themeName = 'default', fontFamily, Wrapper } = opts
  const session = getSession(model)
  const theme = session.getActiveThemeOptions?.(themeName)

  const { figureSize, staticSlices, offsetRadians, centerXY } = model
  const displayResults = await Promise.all(
    model.tracks.map(async track => ({
      id: track.id,
      result: await track.displays[0]!.renderSvg({ ...opts, theme }),
    })),
  )
  const deg = radToDeg(offsetRadians)

  return wrapSvgExport({
    theme,
    width: figureSize,
    height: figureSize,
    margin: 0,
    fontFamily,
    Wrapper,
    children: (
      <g transform={`translate(${centerXY}) rotate(${deg})`}>
        {staticSlices.map(slice => (
          <Ruler key={slice.key} model={model} slice={slice} />
        ))}
        {displayResults.map(({ id, result }) => (
          <Fragment key={id}>{result}</Fragment>
        ))}
      </g>
    ),
  })
}
