import { Suspense, useState } from 'react'

import { observer } from 'mobx-react'

import type React from 'react'

export interface Poster {
  src: string
  width: number
  height: number
}

function isReady(el: HTMLElement) {
  const marker = el.querySelector<HTMLElement>('[data-app-phase]')
  return (
    marker?.dataset.appPhase === 'ready' && Number(marker.dataset.appViews) > 0
  )
}

/**
 * Shows `poster`, a screenshot of the view's opening state, until the view in
 * `children` has drawn. `children` mounts once the box nears the viewport, so
 * a `React.lazy` engine inside it loads only then. The swap waits for the
 * view's `[data-app-phase="ready"]`, then two frames for its pending renders
 * to paint.
 *
 * The loading view sits under the poster, `inert` and at `opacity: 0`: the
 * product components reset inherited styles on their root, so
 * `visibility: hidden` on a wrapper would not hide them. On a box narrower
 * than the screenshot the poster crops its right side rather than shrinking,
 * since the view keeps its height at any width.
 */
export const PosterFirst = observer(function PosterFirst({
  poster,
  alt,
  children,
}: {
  poster: Poster
  alt: string
  children: React.ReactNode
}) {
  const [near, setNear] = useState(false)
  const [ready, setReady] = useState(false)

  function watchViewport(el: HTMLDivElement) {
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setNear(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
    }
  }

  function watchReady(el: HTMLDivElement) {
    const options = {
      subtree: true,
      childList: true,
      attributeFilter: ['data-app-phase'],
    }
    const check = () => {
      if (isReady(el)) {
        observer.disconnect()
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (isReady(el)) {
              setReady(true)
            } else {
              observer.observe(el, options)
            }
          })
        })
      }
    }
    const observer = new MutationObserver(check)
    observer.observe(el, options)
    check()
    return () => {
      observer.disconnect()
    }
  }

  return (
    <div
      ref={watchViewport}
      style={{ display: 'grid', maxWidth: poster.width }}
    >
      {near ? (
        <div
          ref={watchReady}
          inert={!ready}
          style={{ gridArea: '1 / 1', opacity: ready ? 1 : 0 }}
        >
          <Suspense fallback={null}>{children}</Suspense>
        </div>
      ) : null}
      {ready ? null : (
        <img
          {...poster}
          alt={alt}
          style={{
            gridArea: '1 / 1',
            position: 'relative',
            width: '100%',
            objectFit: 'cover',
            objectPosition: 'left top',
          }}
        />
      )}
    </div>
  )
})
