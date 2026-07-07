import { createElement, useEffect, useRef, useState } from 'react'

import createCache from '@emotion/cache'
import { CacheProvider } from '@emotion/react'
import {
  JBrowseLinearGenomeView,
  createViewState,
} from '@jbrowse/react-linear-genome-view2'
import r2wc from '@r2wc/react-to-web-component'
import { createPortal } from 'react-dom'

import type { EmotionCache } from '@emotion/cache'

const assembly = {
  name: 'volvox',
  sequence: {
    adapter: {
      type: 'TwoBitAdapter',
      twoBitLocation: { uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit' },
    },
  },
}

const tracks = [
  {
    type: 'FeatureTrack',
    trackId: 'volvox_gff3',
    name: 'Volvox genes',
    assemblyNames: ['volvox'],
    adapter: {
      type: 'Gff3TabixAdapter',
      gffGzLocation: {
        uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
      },
      index: {
        location: {
          uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz.tbi',
        },
      },
    },
  },
]

type ViewState = ReturnType<typeof createViewState>

const ShadowComponent = () => {
  const nodeRef = useRef<HTMLDivElement>(null)
  const nodeForPinRef = useRef(null)
  const [rootNode, setRootNode] = useState<ShadowRoot>()
  const [cacheNode, setCacheNode] = useState<EmotionCache>()
  const [config, setConfig] = useState<ViewState>()
  useEffect(() => {
    if (!nodeRef.current) {
      return
    }
    const root = nodeRef.current.attachShadow({ mode: 'open' })
    setRootNode(root)
    setCacheNode(
      createCache({ key: 'react-shadow', prepend: true, container: root }),
    )
    // eslint-disable-next-line @eslint-react/set-state-in-effect -- shadow DOM setup requires setState in effect
    setConfig(
      createViewState({
        assembly,
        tracks,
        location: 'ctgA:1105..1221',
        configuration: {
          theme: {
            palette: { primary: { main: '#4400a6' } },
            components: {
              MuiPopover: {
                defaultProps: { container: () => nodeForPinRef.current },
              },
              MuiPopper: {
                defaultProps: { container: () => nodeForPinRef.current },
              },
              MuiTooltip: {
                defaultProps: {
                  slotProps: {
                    popper: { container: () => nodeForPinRef.current },
                  },
                },
              },
              MuiModal: {
                defaultProps: { container: () => nodeForPinRef.current },
              },
              MuiMenu: {
                defaultProps: { container: () => nodeForPinRef.current },
              },
            },
          },
        },
      }),
    )
  }, [])
  return (
    <div ref={nodeRef}>
      {rootNode && config && cacheNode
        ? createPortal(
            <CacheProvider value={cacheNode}>
              <JBrowseLinearGenomeView viewState={config} />
              <div ref={nodeForPinRef} />
            </CacheProvider>,
            rootNode,
          )
        : null}
    </div>
  )
}

const JBrowseCustom = () => createElement(ShadowComponent, null, null)

export default function App() {
  if (customElements.get('jbrowse-linear-view') === undefined) {
    customElements.define('jbrowse-linear-view', r2wc(JBrowseCustom))
  }
  // @ts-expect-error
  return <jbrowse-linear-view />
}
