/* eslint-disable no-console */
// @ts-nocheck
import React, { Fragment, useRef, useState, useEffect } from 'react'
import { Buffer } from 'buffer'
import { createPortal } from 'react-dom'
import { CacheProvider } from '@emotion/react'
import createCache from '@emotion/cache'
// in your code:
// import {createViewState, JBrowseLinearGenomeView} from '@jbrowse/react-linear-genome-view'
import { createViewState, JBrowseLinearGenomeView } from '../../src'
import { getVolvoxConfig } from './util'
import r2wc from '@r2wc/react-to-web-component'

const ShadowComponent = () => {
  const node = useRef(null)
  const nodeForPin = useRef(null)
  const [rootNode, setRootNode] = useState(null)
  const [cacheNode, setCacheNode] = useState(null)
  const [config, setConfig] = useState(null)
  useEffect(() => {
    if (node.current) {
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
      setConfig(
        createViewState({
          assembly: assembly,
          tracks: tracks,
          location: 'ctgA:1105..1221',
          onChange: patch => {
            console.log('patch', patch)
          },

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
                    container: () => {
                      return nodeForPin.current
                    },
                  },
                },
                MuiPopper: {
                  defaultProps: {
                    container: () => {
                      return nodeForPin.current
                    },
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
                    container: () => {
                      return nodeForPin.current
                    },
                  },
                },
                MuiMenu: {
                  defaultProps: {
                    container: () => {
                      return nodeForPin.current
                    },
                  },
                },
                MuiPaper: {
                  defaultProps: {
                    component: nodeForPin.current,
                  },
                },
              },
            },
          },
        }),
      )
    }
  }, [])
  return (
    <Fragment>
      <div ref={node}>
        {rootNode &&
          createPortal(
            <CacheProvider value={cacheNode}>
              <JBrowseLinearGenomeView
                viewState={config}
              ></JBrowseLinearGenomeView>
              <div ref={nodeForPin} />
            </CacheProvider>,
            rootNode,
          )}
      </div>
    </Fragment>
  )
}

const JBrowseCustom = () => {
  return React.createElement(ShadowComponent, null, null)
}

export const ShadowDOMOneLinearGenomeView = () => {
  window.Buffer = Buffer
  if (customElements.get('jbrowse-linear-view') === undefined) {
    customElements.define('jbrowse-linear-view', r2wc(JBrowseCustom))
  }
  return (
    <Fragment>
      <jbrowse-linear-view></jbrowse-linear-view>
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/ShadowDOMOneLinearGenomeView.tsx">
        Source code
      </a>
    </Fragment>
  )
}
