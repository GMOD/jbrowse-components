import { useEffect, useMemo, useState } from 'react'

import {
  errorText,
  useNoteDraft,
  useReview,
} from '@jbrowse/browser-test-utils/reviewApp'

import type {
  CardMessage,
  DraftStore,
  ReviewEntry,
} from '@jbrowse/browser-test-utils/reviewApp'

// Reviewing a clip is watching it and saying yes or no. None of the figure
// machinery applies — there is no baseline to diff against, no store to publish
// to and no live session behind it — so this is its own view rather than a
// shape pushed through the figure card.

export interface ClipEntry extends ReviewEntry {
  bytes: number
  modified: string
  duration?: number
  src: string
  poster?: string
  transcript?: string
}

function mmss(seconds: number | undefined) {
  if (seconds === undefined) {
    return '?'
  }
  const whole = Math.round(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

// The questions the shoot asked, out of the transcript written beside the clip.
// What a reviewer approves is a session, and a session is its questions —
// reading them beside the video beats scrubbing for the captions. A shoot
// records them itself, because a CLI's own output stream carries what it said
// and not what it was asked.
function questionsOf(body: unknown) {
  const questions = (body as { questions?: unknown } | null)?.questions
  return Array.isArray(questions)
    ? questions.filter(q => typeof q === 'string')
    : []
}

function Questions({ url }: { url: string }) {
  const [questions, setQuestions] = useState<string[]>([])
  useEffect(() => {
    const abort = new AbortController()
    fetch(url, { signal: abort.signal })
      .then(r => r.json())
      .then((body: unknown) => {
        setQuestions(questionsOf(body))
      })
      .catch(() => {
        // a take shot without a transcript is still watchable
      })
    return () => {
      abort.abort()
    }
  }, [url])
  return questions.length ? (
    <ol className="clip-questions">
      {questions.map(q => (
        <li key={q}>{q}</li>
      ))}
    </ol>
  ) : null
}

function ClipCard({
  clip,
  drafts,
  message,
  saveNote,
  setVerdict,
  clearVerdict,
}: {
  clip: ClipEntry
  drafts: DraftStore
  message?: CardMessage
  saveNote: (name: string, note: string) => void
  setVerdict: (name: string, status: 'good' | 'bad', note: string) => void
  clearVerdict: (name: string) => void
}) {
  const note = useNoteDraft({ entry: clip, drafts, onSave: saveNote })
  const status = clip.verdict?.status
  return (
    <section className="clip-card">
      <header className="clip-head">
        <h2>{clip.name}</h2>
        <span className="clip-meta">
          {mmss(clip.duration)} · {(clip.bytes / 1e6).toFixed(1)} MB ·{' '}
          {new Date(clip.modified).toLocaleString()}
        </span>
      </header>
      <video
        controls
        preload="metadata"
        poster={clip.poster}
        src={clip.src}
        className="clip-video"
      />
      {clip.transcript ? <Questions url={clip.transcript} /> : null}
      <div className="clip-controls">
        <button
          type="button"
          className={status === 'good' ? 'pressed' : ''}
          onClick={() => {
            setVerdict(clip.name, 'good', note.value)
          }}
        >
          Approve
        </button>
        <button
          type="button"
          className={status === 'bad' ? 'pressed' : ''}
          onClick={() => {
            setVerdict(clip.name, 'bad', note.value)
          }}
        >
          Deny
        </button>
        {status ? (
          <button
            type="button"
            onClick={() => {
              clearVerdict(clip.name)
            }}
          >
            Clear
          </button>
        ) : null}
        {clip.stale ? (
          <span className="clip-stale">re-shot since this verdict</span>
        ) : null}
        {message ? (
          <span className={`clip-msg ${message.kind}`}>{message.text}</span>
        ) : null}
        {note.hint ? <span className="clip-hint">{note.hint}</span> : null}
      </div>
      <textarea
        ref={note.ref}
        className="clip-note"
        placeholder="What is wrong with this take?"
        value={note.value}
        onChange={note.onChange}
        onFocus={note.onFocus}
        onBlur={note.onBlur}
      />
    </section>
  )
}

export function Videos() {
  const {
    entries,
    loadEntries,
    drafts,
    messages,
    setVerdict,
    saveNote,
    clearVerdict,
  } = useReview<ClipEntry>({
    draftsKey: 'video-review-drafts',
    imageMovedPhrase: 'this take was re-shot',
    endpoint: '/api/video-verdict',
  })
  const [error, setError] = useState<string>()

  useEffect(() => {
    const abort = new AbortController()
    fetch('/api/videos', { signal: abort.signal })
      .then(r => r.json())
      .then((body: unknown) => {
        loadEntries(body as ClipEntry[])
      })
      .catch((e: unknown) => {
        if (!abort.signal.aborted) {
          setError(errorText(e))
        }
      })
    return () => {
      abort.abort()
    }
  }, [loadEntries])

  // newest first: a review session is about the take just shot
  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.modified.localeCompare(a.modified)),
    [entries],
  )

  return error ? (
    <p className="clip-empty">{error}</p>
  ) : sorted.length ? (
    <div className="clip-list">
      {sorted.map(clip => (
        <ClipCard
          key={clip.name}
          clip={clip}
          drafts={drafts}
          message={messages[clip.name]}
          saveNote={saveNote}
          setVerdict={setVerdict}
          clearVerdict={clearVerdict}
        />
      ))}
    </div>
  ) : (
    <p className="clip-empty">
      No clips found. Name a directory of them with{' '}
      <code>--clips=&lt;dir&gt;</code>.
    </p>
  )
}
