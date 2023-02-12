import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { when } from 'mobx'
import { getSession } from '@jbrowse/core/util'
import { ThemeProvider } from '@mui/material'
import { createJBrowseTheme } from '@jbrowse/core/ui'

// locals
import { DotplotViewModel, ExportSvgOptions } from '../model'
import SVGBackground from './SVGBackground'

// render LGV to SVG
export async function renderToSvg(
  model: DotplotViewModel,
  opts: ExportSvgOptions,
) {
  await when(() => model.initialized)
  const { Wrapper = ({ children }) => <>{children}</> } = opts
  const session = getSession(model)
  const { width, tracks, height } = model
  const shift = 50
  const displayResults = await Promise.all(
    tracks.map(async track => {
      const display = track.displays[0]
      await when(() => (display.ready !== undefined ? display.ready : true))
      return { track, result: await display.renderSvg(opts) }
    }),
  )

  // the xlink namespace is used for rendering <image> tag
  return renderToStaticMarkup(
    <ThemeProvider theme={createJBrowseTheme(session.theme)}>
      <Wrapper>
        <svg
          width={width}
          height={height}
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
          viewBox={[0, 0, width + shift * 2, height].toString()}
        >
          <SVGBackground width={width} height={height} shift={shift} />

          <g>
            {displayResults.map(({ result }, i) => (
              <React.Fragment key={i}>{result}</React.Fragment>
            ))}
          </g>
        </svg>
      </Wrapper>
    </ThemeProvider>,
  )
}
