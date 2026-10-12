import { REVIEW_COMMAND_IDS } from './registry.ts'

import type { ReviewCommandId } from './registry.ts'

/**
 * A binding is a key name as {@link keyNameOf} spells an event: a lower-case
 * letter or character, `Enter`, `Space`, `Escape`…, with a `Shift+` prefix for
 * a shifted letter or named key. A shifted punctuation key is the character it
 * types.
 */
export const DEFAULT_REVIEW_KEYMAP: Readonly<Record<ReviewCommandId, string>> =
  {
    next: 'j',
    previous: 'k',
    nextUnreviewed: 'n',
    restoreViewport: 'Enter',
    sort: 's',
    accept: 'a',
    reject: 'r',
    flag: 'f',
    clearDecision: 'u',
    details: 'Space',
  }

/**
 * Bare keys a core or plugin shortcut already owns, which a review binding
 * must not shadow. None today: every document-level shortcut in the tree is a
 * Ctrl/Cmd chord, which the adapter never takes. A future bare-key consumer
 * lands here, so the conflict check below finds it.
 */
export const RESERVED_KEYS: readonly string[] = []

/**
 * Bare mnemonic letters match on `key`, not `code`: a Dvorak or AZERTY user
 * expects the key LABELLED `j`, where the LGV's own chords (`KeyD`) match the
 * physical key, which is right for a chord.
 */
export function keyNameOf(e: Pick<KeyboardEvent, 'key' | 'shiftKey'>) {
  const key = e.key === ' ' ? 'Space' : e.key
  const named = key.length > 1
  const letter = /^[a-z]$/i.test(key)
  const base = letter ? key.toLowerCase() : key
  return e.shiftKey && (named || letter) ? `Shift+${base}` : base
}

function normalizeBinding(binding: string) {
  const shift = /^shift\+/i.test(binding)
  const rest = shift ? binding.slice('shift+'.length) : binding
  const key =
    rest === ' '
      ? 'Space'
      : rest.length === 1
        ? rest.toLowerCase()
        : rest.charAt(0).toUpperCase() + rest.slice(1)
  return shift ? `Shift+${key}` : key
}

export interface ResolvedKeymap {
  bindings: ReadonlyMap<string, ReviewCommandId>
  problems: string[]
}

/**
 * `overrides` (the plugin config's `shortcuts`) over the defaults. A binding
 * that collides with another or with a reserved key is reported, and the first
 * command to claim a key keeps it. An empty string unbinds a command.
 */
export function resolveKeymap(overrides?: unknown): ResolvedKeymap {
  const problems: string[] = []
  const merged: Record<string, string> = { ...DEFAULT_REVIEW_KEYMAP }
  if (overrides && typeof overrides === 'object') {
    for (const [id, binding] of Object.entries(overrides)) {
      if (!(REVIEW_COMMAND_IDS as readonly string[]).includes(id)) {
        problems.push(`unknown review command "${id}"`)
      } else if (typeof binding !== 'string') {
        problems.push(`binding for "${id}" is not a string`)
      } else {
        merged[id] = binding
      }
    }
  }
  const bindings = new Map<string, ReviewCommandId>()
  for (const id of REVIEW_COMMAND_IDS) {
    const raw = merged[id]
    if (raw) {
      const key = normalizeBinding(raw)
      const holder = bindings.get(key)
      if (holder) {
        problems.push(`"${key}" is bound to both ${holder} and ${id}`)
      } else if (RESERVED_KEYS.includes(key)) {
        problems.push(`"${key}" (${id}) is reserved by another shortcut`)
      } else {
        bindings.set(key, id)
      }
    }
  }
  return { bindings, problems }
}

/** The binding a command ended up with, for the widget's key hints. */
export function keyFor(keymap: ResolvedKeymap, id: ReviewCommandId) {
  for (const [key, cmd] of keymap.bindings) {
    if (cmd === id) {
      return key
    }
  }
  return undefined
}
