import { Suspense, lazy, useState } from 'react'

const LinearGenomeView = lazy(async () => ({
  default: (await import('@jbrowse/react-linear-genome-view2'))
    .LinearGenomeView,
}))

// A screenshot of this same view once it finished drawing, taken at the width
// below by `pnpm capture-poster`
const poster = {
  src: '/storybook/lgv/static-first-paint.png',
  width: 800,
  height: 232,
}

export default function StaticFirstPaint() {
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
    const isReady = () => {
      const marker = el.querySelector<HTMLElement>('[data-app-phase]')
      return (
        marker?.dataset.appPhase === 'ready' &&
        Number(marker.dataset.appViews) > 0
      )
    }
    // two frames, so the view's own pending renders paint before the poster
    // comes down
    const check = () => {
      if (isReady()) {
        observer.disconnect()
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (isReady()) {
              setReady(true)
            } else {
              observer.observe(el, options)
            }
          })
        })
      }
    }
    const options = {
      subtree: true,
      childList: true,
      attributeFilter: ['data-app-phase'],
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
        // opacity, not visibility: the view's root resets inherited styles
        <div
          ref={watchReady}
          inert={!ready}
          style={{ gridArea: '1 / 1', opacity: ready ? 1 : 0 }}
        >
          <Suspense fallback={null}>
            <LinearGenomeView
              assembly={{
                name: 'hg38',
                uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
                refNameAliases: {
                  uri: 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
                },
              }}
              tracks={[
                {
                  trackId: 'hg38-ncbi-refseq-curated',
                  name: 'NCBI RefSeq Curated',
                  uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz',
                  index:
                    'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz.csi',
                },
              ]}
              view={{
                loc: 'chr7:155,799,529..155,812,871',
                tracks: ['hg38-ncbi-refseq-curated'],
              }}
            />
          </Suspense>
        </div>
      ) : null}
      {ready ? null : (
        <img
          {...poster}
          alt="NCBI RefSeq genes at SHH, chr7:155,799,529..155,812,871"
          // narrower than the screenshot, crop its right side rather than shrink
          // it, since the view keeps its height at any width
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
}
