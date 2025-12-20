import React, { useEffect, useRef, useState } from 'react'

import createCache from '@emotion/cache'
import { CacheProvider } from '@emotion/react'
import r2wc from '@r2wc/react-to-web-component'
import { createPortal } from 'react-dom'

import { getVolvoxConfig } from './util'
import { JBrowseLinearGenomeView, createViewState } from '../../src'

import type { EmotionCache } from '@emotion/cache'

// in your code:
// import {createViewState, JBrowseLinearGenomeView} from '@jbrowse/react-linear-genome-view2'

type ViewState = ReturnType<typeof createViewState>

const ShadowComponent = () => {
  const node = useRef<HTMLDivElement>(null)
  const nodeForPin = useRef(null)
  const [rootNode, setRootNode] = useState<ShadowRoot>()
  const [cacheNode, setCacheNode] = useState<EmotionCache>()
  const [config, setConfig] = useState<ViewState>()
  useEffect(() => {
    if (!node.current) {
      return
    }
    const { assembly, tracks } = getVolvoxConfig()
    const root = node.current.attachShadow({ mode: 'open' })
    setRootNode(root)
    setCacheNode(
      createCache({
        key: 'react-shadow',
        prepend: true,
        container: root,
      }),
    )

    // see https://mui.com/material-ui/guides/shadow-dom/ for
    // defaultProps.container note
    setConfig(
      createViewState({
        assembly: assembly,
        tracks: tracks,
        location: 'ctgA:1105..1221',
        configuration: {
          theme: {
            palette: {
              primary: {
                main: '#4400a6',
              },
            },
            components: {
              MuiPopover: {
                defaultProps: {
                  container: () => nodeForPin.current,
                },
              },
              MuiPopper: {
                defaultProps: {
                  container: () => nodeForPin.current,
                },
              },
              MuiTooltip: {
                defaultProps: {
                  popperprops: {
                    container: () => nodeForPin.current,
                  },
                },
              },
              MuiModal: {
                defaultProps: {
                  container: () => nodeForPin.current,
                },
              },
              MuiMenu: {
                defaultProps: {
                  container: () => nodeForPin.current,
                },
              },
              MuiPaper: {
                defaultProps: () => nodeForPin.current,
              },
            },
          },
        },
      }),
    )
  }, [])
  return (
    <div ref={node}>
      {rootNode && config
        ? createPortal(
            // @ts-expect-error
            <CacheProvider value={cacheNode}>
              <JBrowseLinearGenomeView viewState={config} />
              <div ref={nodeForPin} />
            </CacheProvider>,
            rootNode,
          )
        : null}
    </div>
  )
}

const JBrowseCustom = () => {
  return React.createElement(ShadowComponent, null, null)
}

export const ShadowDOMOneLinearGenomeView = () => {
  if (customElements.get('jbrowse-linear-view') === undefined) {
    customElements.define('jbrowse-linear-view', r2wc(JBrowseCustom))
  }
  return (
    <div>
      {/* @ts-expect-error */}
      <jbrowse-linear-view />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/ShadowDOMOneLinearGenomeView.tsx">
        Source code
      </a>
    </div>
  )
}
