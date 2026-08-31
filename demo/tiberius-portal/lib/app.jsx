// The review page. One component tree, rendered twice: to a string when the
// portal is written, so the cards and their captures are in the HTML before any
// script runs, and again in the browser to hydrate the parts that take input.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export const VERDICTS = [
  { v: 'keep', label: 'Keep', key: '1' },
  { v: 'edit', label: 'Needs editing', key: '2' },
  { v: 'reject', label: 'Reject', key: '3' },
]

const VERDICT_FILTERS = [
  ['all', 'Any verdict'],
  ['unreviewed', 'Unreviewed'],
  ['keep', 'Keep'],
  ['edit', 'Needs editing'],
  ['reject', 'Reject'],
]

const num = n => Math.abs(n).toLocaleString()

// What the class alone cannot say: which junction, and by how much. A splice
// site 12 bp out and an intron cut through the middle of a reference exon are
// the same class and completely different edits.
function phrase(c) {
  const at = `intron ${c.index}`
  if (c.kind === 'donor') {
    return `${at} donor off by ${num(c.shift)} bp`
  }
  if (c.kind === 'acceptor') {
    return `${at} acceptor off by ${num(c.shift)} bp`
  }
  if (c.kind === 'skips') {
    return `${at} skips ${c.skipped} reference exon${c.skipped > 1 ? 's' : ''}`
  }
  if (c.kind === 'in-exon') {
    return `${at} falls inside a reference exon`
  }
  if (c.kind === 'shifted') {
    return `${at} shifted ${num(c.shift)} bp`
  }
  return `${at} matches no reference intron`
}

export function storageKey(portalId) {
  return `gene-review:${portalId}`
}

export function matches(card, { cls, verdictFilter, q, verdicts }) {
  if (cls !== 'all' && card.cls !== cls) {
    return false
  }
  const v = verdicts[card.id] || ''
  if (verdictFilter === 'unreviewed' && v) {
    return false
  }
  if (
    verdictFilter !== 'all' &&
    verdictFilter !== 'unreviewed' &&
    v !== verdictFilter
  ) {
    return false
  }
  if (q) {
    const hay =
      `${card.id} ${(card.genes || []).join(' ')} ${card.loc}`.toLowerCase()
    if (!hay.includes(q.trim().toLowerCase())) {
      return false
    }
  }
  return true
}

// Only the models this build carries. A rerun with a smaller --max keeps the
// portalId, so the earlier verdicts are still in storage, and counting them
// reads as "16 of 12 judged" over a bar past its own end — while dropping them
// would throw away a review the next wider rerun could still use.
export function tallyVerdicts(cards, verdicts) {
  const c = { keep: 0, edit: 0, reject: 0 }
  for (const card of cards) {
    const v = verdicts[card.id]
    if (c[v] !== undefined) {
      c[v]++
    }
  }
  return c
}

export function toTsv(cards, verdicts) {
  const apollo = cards.some(c => c.apollo)
  // an annotator picking the queue up in Apollo wants the link, not the locus
  const head = [
    'model_id',
    'class',
    'locus',
    'exons',
    'strand',
    'reference_genes',
    'verdict',
  ]
  if (apollo) {
    head.push('apollo_url')
  }
  const lines = [head.join('\t')]
  for (const c of cards) {
    const row = [
      c.id,
      c.cls,
      c.loc,
      c.nExons,
      c.strand,
      (c.genes || []).join(';'),
      verdicts[c.id] || 'unreviewed',
    ]
    if (apollo) {
      row.push(c.apollo || '')
    }
    lines.push(row.join('\t'))
  }
  return `${lines.join('\n')}\n`
}

// The other half of Export: verdicts live in one browser's localStorage, so
// without this a cleared site setting, a second reviewer or a second machine
// starts the queue from nothing.
export function fromTsv(text, cards) {
  const rows = text.split(/\r?\n/).filter(l => l.trim())
  const head = (rows.shift() || '').split('\t')
  const idAt = head.indexOf('model_id')
  const vAt = head.indexOf('verdict')
  if (idAt === -1 || vAt === -1) {
    return { error: 'That file has no model_id and verdict columns.' }
  }
  const known = new Set(cards.map(c => c.id))
  const changes = {}
  let applied = 0
  let unknown = 0
  for (const line of rows) {
    const f = line.split('\t')
    const id = f[idAt]
    const v = f[vAt]
    if (!id) {
      continue
    }
    if (v === 'unreviewed' || v === '') {
      changes[id] = null
    } else if (v === 'keep' || v === 'edit' || v === 'reject') {
      changes[id] = v
    } else {
      continue
    }
    if (known.has(id)) {
      applied++
    } else {
      unknown++
    }
  }
  return { changes, applied, unknown }
}

const Detail = React.memo(function Detail({ conflicts }) {
  if (!conflicts?.length) {
    return null
  }
  const shown = conflicts.slice(0, 4).map(phrase)
  if (conflicts.length > shown.length) {
    shown.push(`${conflicts.length - shown.length} more`)
  }
  const { of } = conflicts[0]
  return (
    <div className="detail">
      <b>
        {conflicts.length} of {of} junction{of === 1 ? '' : 's'} disagree
        {conflicts.length === 1 ? 's' : ''}
      </b>
      {' — '}
      <span className="j">{shown.join('; ')}</span>
    </div>
  )
})

const Card = React.memo(function Card({
  card,
  meta,
  verdict,
  current,
  onVerdict,
  onPick,
  bind,
}) {
  const genes = card.genes?.length
    ? card.genes.join(' + ')
    : 'no reference gene here'
  return (
    <article
      className="card"
      ref={el => bind(card.id, el)}
      data-id={card.id}
      data-cls={card.cls}
      data-verdict={verdict}
      data-current={current ? 'true' : undefined}
      onClick={e => {
        if (!e.target.closest('a') && !e.target.closest('.verdicts button')) {
          onPick(card.id)
        }
      }}
    >
      <div className="card-head">
        <span className="chip">{meta.label}</span>
        <span className="model">{card.id}</span>
        <span className="genes">{genes}</span>
        <span className="meta">
          {card.loc} · {card.nExons} exons · {card.spanKb} kb ·{' '}
          {card.strand === '-' ? 'minus' : 'plus'} strand
          {card.gapBp ? ` · ${card.gapBp.toLocaleString()} bp apart` : ''}
        </span>
      </div>
      <div className="why">{meta.why}</div>
      <Detail conflicts={card.conflicts} />
      {card.img ? (
        <img
          className="shot"
          loading="lazy"
          alt={`Genome view of ${card.id}`}
          src={card.img}
        />
      ) : (
        <div className="missing">
          No capture for this model — the portal was built with --no-capture, or
          this one failed. The link still opens it live.
        </div>
      )}
      <div className="card-foot">
        <div className="verdicts">
          {VERDICTS.map(b => (
            <button
              key={b.v}
              type="button"
              data-v={b.v}
              aria-pressed={verdict === b.v}
              onClick={() => {
                onPick(card.id)
                onVerdict(card.id, b.v)
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
        <span className="next">
          Annotator action: <b>{meta.action}</b>
        </span>
        <div className="links">
          <a className="live" href={card.url} target="_blank" rel="noopener">
            Open in JBrowse
          </a>
          {card.apollo ? (
            <a
              className="live apollo"
              href={card.apollo}
              target="_blank"
              rel="noopener"
            >
              Edit in Apollo
            </a>
          ) : null}
        </div>
      </div>
    </article>
  )
})

export function App({ data }) {
  // Verdicts start empty on both sides of hydration and arrive from
  // localStorage on mount — the server has no way to know them, and rendering
  // a guess is a mismatch.
  const [verdicts, setVerdicts] = useState({})
  const [keysOpen, setKeysOpen] = useState(false)
  const [cls, setCls] = useState('all')
  const [verdictFilter, setVerdictFilter] = useState('all')
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(/** @type {string | null} */ (null))
  const [msg, setMsg] = useState('')

  const nodes = useRef(new Map())
  const wantScroll = useRef(false)
  const fileInput = useRef(null)
  const searchInput = useRef(null)

  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(storageKey(data.portalId)) || '{}',
      )
      if (saved.verdicts) {
        setVerdicts(saved.verdicts)
      }
      if (saved.keys) {
        setKeysOpen(true)
      }
    } catch {
      /* private window, or site data blocked */
    }
  }, [data.portalId])

  const persist = useCallback(
    (nextVerdicts, nextKeys) => {
      try {
        localStorage.setItem(
          storageKey(data.portalId),
          JSON.stringify({ verdicts: nextVerdicts, keys: nextKeys }),
        )
      } catch {
        /* nothing to do; the page still works for this session */
      }
    },
    [data.portalId],
  )

  const bind = useCallback((id, el) => {
    if (el) {
      nodes.current.set(id, el)
    } else {
      nodes.current.delete(id)
    }
  }, [])

  const visible = useMemo(
    () =>
      data.cards.filter(c => matches(c, { cls, verdictFilter, q, verdicts })),
    [data.cards, cls, verdictFilter, q, verdicts],
  )
  const counts = useMemo(
    () => tallyVerdicts(data.cards, verdicts),
    [data.cards, verdicts],
  )
  const done = counts.keep + counts.edit + counts.reject

  useEffect(() => {
    if (!wantScroll.current) {
      return
    }
    wantScroll.current = false
    nodes.current.get(cursor)?.scrollIntoView({
      block: 'center',
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    })
  }, [cursor])

  const setVerdict = useCallback(
    (id, val) => {
      const next = { ...verdicts }
      if (next[id] === val) {
        delete next[id]
      } else {
        next[id] = val
      }

      // Under a verdict filter the card just judged leaves the list. The cursor
      // steps to the one closing over it — not out of the page with the card,
      // and not back to the top of a queue the reviewer is deep into.
      const card = data.cards.find(c => c.id === id)
      if (card && !matches(card, { cls, verdictFilter, q, verdicts: next })) {
        const i = visible.findIndex(c => c.id === id)
        const successor =
          i === -1 ? null : (visible[i + 1] ?? visible[i - 1] ?? null)
        setCursor(successor?.id ?? null)
      }
      setVerdicts(next)
      persist(next, keysOpen)
    },
    [verdicts, data.cards, cls, verdictFilter, q, visible, persist, keysOpen],
  )

  const toggleKeys = useCallback(() => {
    setKeysOpen(prev => {
      persist(verdicts, !prev)
      return !prev
    })
  }, [persist, verdicts])

  const move = useCallback(
    step => {
      if (!visible.length) {
        return
      }
      const i = visible.findIndex(c => c.id === cursor)
      const next =
        i === -1
          ? step > 0
            ? 0
            : visible.length - 1
          : Math.min(visible.length - 1, Math.max(0, i + step))
      wantScroll.current = true
      setCursor(visible[next].id)
    },
    [visible, cursor],
  )

  // A queue of a hundred cards is read one at a time, and every verdict on it
  // was a click on a small button somewhere down the page.
  useEffect(() => {
    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return
      }
      const t = e.target
      if (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) {
        if (e.key === 'Escape') {
          t.blur()
        }
        return
      }
      if (e.key === '/') {
        e.preventDefault()
        searchInput.current?.focus()
        searchInput.current?.select()
        return
      }
      if (e.key === '?') {
        toggleKeys()
        return
      }
      if (e.key === 'j') {
        e.preventDefault()
        move(1)
        return
      }
      if (e.key === 'k') {
        e.preventDefault()
        move(-1)
        return
      }
      if (e.key === 'o') {
        const a = nodes.current.get(cursor)?.querySelector('a.live')
        if (a) {
          window.open(a.href, '_blank', 'noopener')
        }
        return
      }
      const hit = VERDICTS.find(b => b.key === e.key)
      if (!hit) {
        return
      }
      e.preventDefault()
      const id = visible.some(c => c.id === cursor) ? cursor : visible[0]?.id
      if (!id) {
        return
      }
      if (id !== cursor) {
        wantScroll.current = true
        setCursor(id)
      }
      setVerdict(id, hit.v)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
    }
  }, [move, toggleKeys, setVerdict, visible, cursor])

  // Changing a filter can also strand the cursor on a card that is no longer
  // listed; there is no position to hold on to, so it goes to the top.
  useEffect(() => {
    if (cursor === null || visible.some(c => c.id === cursor)) {
      return
    }
    setCursor(visible.length ? visible[0].id : null)
  }, [visible, cursor])

  const say = useCallback(text => {
    setMsg(text)
    const t = setTimeout(() => {
      setMsg('')
    }, 5000)
    return () => {
      clearTimeout(t)
    }
  }, [])

  function exportTsv() {
    const blob = new Blob([toTsv(data.cards, verdicts)], {
      type: 'text/tab-separated-values',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${data.portalId}-decisions.tsv`
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => {
      URL.revokeObjectURL(a.href)
    }, 1000)
  }

  function importTsv(file) {
    const reader = new FileReader()
    reader.onload = () => {
      const res = fromTsv(String(reader.result), data.cards)
      if (res.error) {
        say(res.error)
        return
      }
      setVerdicts(prev => {
        const next = { ...prev }
        for (const [id, v] of Object.entries(res.changes)) {
          if (v === null) {
            delete next[id]
          } else {
            next[id] = v
          }
        }
        persist(next, keysOpen)
        return next
      })
      say(
        `${res.applied} verdict${res.applied === 1 ? '' : 's'} read in${
          res.unknown
            ? `, ${res.unknown} for models this portal does not carry`
            : ''
        }.`,
      )
    }
    reader.readAsText(file)
  }

  const clsCounts = useMemo(() => {
    const out = {}
    for (const c of data.cards) {
      out[c.cls] = (out[c.cls] || 0) + 1
    }
    return out
  }, [data.cards])

  const chips = [{ k: 'all', label: 'All', n: data.cards.length }].concat(
    data.classOrder
      .filter(k => clsCounts[k])
      .map(k => ({ k, label: data.classes[k].label, n: clsCounts[k] })),
  )

  const pct = x => `${data.cards.length ? (x / data.cards.length) * 100 : 0}%`

  return (
    <div className="wrap">
      <div className="masthead">
        <div className="eyebrow">{data.eyebrow}</div>
        <h1>{data.title}</h1>
        {/* lede and footer are prose make-portal composes itself, with counts
            interpolated into it and nothing off the annotation files. */}
        {/* eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml */}
        <p className="lede" dangerouslySetInnerHTML={{ __html: data.lede }} />
      </div>

      <div className="controls">
        <div className="row1">
          <div className="stat">
            <span className="n">{data.total}</span>
            <span className="k">models predicted</span>
          </div>
          <div className="rule" />
          <div className="stat agrees">
            <span className="n">{data.agrees}</span>
            <span className="k">agree with reference</span>
          </div>
          <div className="stat flagged">
            <span className="n">{data.flagged}</span>
            <span className="k">flagged</span>
          </div>
          <div className="rule" />
          <div className="progress">
            <div className="r">
              <span id="done">
                {done} of {data.cards.length} judged
              </span>
              <span id="tally">
                {counts.keep} keep · {counts.edit} edit · {counts.reject} reject
              </span>
            </div>
            <div className="bar">
              <span className="b-keep" style={{ width: pct(counts.keep) }} />
              <span className="b-edit" style={{ width: pct(counts.edit) }} />
              <span
                className="b-reject"
                style={{ width: pct(counts.reject) }}
              />
            </div>
          </div>
        </div>

        <div className="row2">
          <div className="filters">
            {chips.map(ch => (
              <button
                key={ch.k}
                type="button"
                data-cls={ch.k}
                aria-pressed={cls === ch.k}
                onClick={() => {
                  setCls(ch.k)
                }}
              >
                {ch.label}
                <span className="count">{ch.n}</span>
              </button>
            ))}
          </div>
          <span className="sep" />
          <select
            id="vf"
            aria-label="Filter by verdict"
            value={verdictFilter}
            onChange={e => {
              setVerdictFilter(e.target.value)
            }}
          >
            {VERDICT_FILTERS.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="search"
            id="q"
            ref={searchInput}
            placeholder="Find a model or gene"
            value={q}
            onChange={e => {
              setQ(e.target.value)
            }}
          />
          <span id="msg" className="msg" role="status">
            {msg}
          </span>
          <span className="spacer" />
          <div className="actions">
            <button
              id="keysbtn"
              type="button"
              aria-expanded={keysOpen}
              onClick={toggleKeys}
            >
              Keys
            </button>
            <button
              id="import"
              type="button"
              onClick={() => fileInput.current?.click()}
            >
              Import
            </button>
            <input
              type="file"
              id="importfile"
              ref={fileInput}
              accept=".tsv,.txt,text/tab-separated-values"
              hidden
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) {
                  importTsv(file)
                }
                e.target.value = ''
              }}
            />
            <button id="export" type="button" onClick={exportTsv}>
              Export decisions
            </button>
            <button
              id="reset"
              type="button"
              disabled={!done}
              onClick={() => {
                if (!confirm('Clear every verdict on this portal?')) {
                  return
                }
                setVerdicts({})
                persist({}, keysOpen)
              }}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="keys" id="keys" hidden={!keysOpen}>
          <span>
            <kbd>j</kbd>
            <kbd>k</kbd> move between cards
          </span>
          <span>
            <kbd>1</kbd> keep <kbd>2</kbd> needs editing <kbd>3</kbd> reject
          </span>
          <span>
            <kbd>o</kbd> open in JBrowse
          </span>
          <span>
            <kbd>/</kbd> search
          </span>
          <span>
            <kbd>?</kbd> these keys
          </span>
        </div>
      </div>

      <div className="cards" id="cards">
        {visible.length ? (
          visible.map(c => (
            <Card
              key={c.id}
              card={c}
              meta={data.classes[c.cls]}
              verdict={verdicts[c.id] || ''}
              current={c.id === cursor}
              onVerdict={setVerdict}
              onPick={setCursor}
              bind={bind}
            />
          ))
        ) : (
          <div className="empty">No models match these filters.</div>
        )}
      </div>

      {/* eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml */}
      <footer dangerouslySetInnerHTML={{ __html: data.footer }} />
    </div>
  )
}
