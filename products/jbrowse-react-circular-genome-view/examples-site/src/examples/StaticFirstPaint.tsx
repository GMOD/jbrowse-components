import { Suspense, lazy, useState } from 'react'

const CircularGenomeView = lazy(async () => ({
  default: (await import('@jbrowse/react-circular-genome-view2'))
    .CircularGenomeView,
}))

// A screenshot of this same view once it finished drawing, taken at the width
// below by `pnpm capture-poster`
const poster = {
  src: '/storybook/cgv/static-first-paint.png',
  width: 800,
  height: 406,
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
            <CircularGenomeView
              assembly={{
                name: 'hg19',
                aliases: ['GRCh37'],
                uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
                refNameAliases: {
                  uri: 'https://jbrowse.org/genomes/hg19/hg19_aliases.txt',
                },
              }}
              tracks={[
                {
                  trackId: 'pacbio_sv_vcf',
                  name: 'HG002 Pacbio SV (VCF)',
                  uri: 'https://jbrowse.org/genomes/hg19/pacbio/hs37d5.HG002-SequelII-CCS.bnd-only.sv.vcf.gz',
                },
              ]}
              view={{ tracks: ['pacbio_sv_vcf'] }}
            />
          </Suspense>
        </div>
      ) : null}
      {ready ? null : (
        <img
          {...poster}
          alt="HG002 PacBio structural variants as chords around hg19"
          // narrower than the screenshot, crop both sides rather than shrink it,
          // since the view keeps its height at any width
          style={{
            gridArea: '1 / 1',
            position: 'relative',
            width: '100%',
            objectFit: 'cover',
            objectPosition: 'center top',
          }}
        />
      )}
    </div>
  )
}
