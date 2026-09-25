import { createElement, useEffect, useRef, useState } from 'react'

import createCache from '@emotion/cache'
import { CacheProvider } from '@emotion/react'
import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'
import r2wc from '@r2wc/react-to-web-component'
import { createPortal } from 'react-dom'

import type { EmotionCache } from '@emotion/cache'

const ShadowComponent = () => {
  const nodeRef = useRef<HTMLDivElement>(null)
  const nodeForPinRef = useRef(null)
  const [shadow, setShadow] = useState<{
    root: ShadowRoot
    cache: EmotionCache
  }>()
  useEffect(() => {
    const host = nodeRef.current
    if (host) {
      const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
      setShadow({
        root,
        cache: createCache({
          key: 'react-shadow',
          prepend: true,
          container: root,
        }),
      })
    }
  }, [])
  const state = useCreateViewState({
    assembly: {
      name: 'volvox',
      uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
    },
    tracks: [
      {
        type: 'FeatureTrack',
        trackId: 'volvox_gff3',
        name: 'Volvox genes',
        assemblyNames: ['volvox'],
        adapter: {
          type: 'Gff3TabixAdapter',
          uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
        },
      },
    ],
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
  })
  return (
    <div ref={nodeRef}>
      {shadow && state
        ? createPortal(
            <CacheProvider value={shadow.cache}>
              <JBrowseLinearGenomeView viewState={state} />
              <div ref={nodeForPinRef} />
            </CacheProvider>,
            shadow.root,
          )
        : null}
    </div>
  )
}

export default function ShadowDOMOneLinearGenomeView() {
  if (customElements.get('jbrowse-linear-view') === undefined) {
    customElements.define('jbrowse-linear-view', r2wc(ShadowComponent))
  }
  return createElement('jbrowse-linear-view')
}
