import { useState } from 'react'
import type { SyntheticEvent } from 'react'

import styles from './NewsletterSignup.module.css'
import { baseUrl } from '../lib/base-url.ts'

const API_URL = import.meta.env.PUBLIC_NEWSLETTER_API_URL as string | undefined

export default function NewsletterSignup() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch(`${API_URL}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = (await res.json()) as { message?: string; error?: string }
      if (res.ok) {
        setStatus('success')
        setMessage(data.message ?? 'Subscribed!')
      } else {
        setStatus('error')
        setMessage(data.error ?? 'Something went wrong, please try again.')
      }
    } catch {
      setStatus('error')
      setMessage('Network error, please try again.')
    }
  }

  if (!API_URL) {
    return (
      <p className={styles.fallback}>
        Newsletter signup is unavailable here — see{' '}
        <a href={`${baseUrl}/contact/`}>contact</a> for other ways to follow
        JBrowse releases.
      </p>
    )
  }

  return (
    <div className={styles.wrap}>
      {status === 'success' ? (
        <p className={styles.success}>{message}</p>
      ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="email"
            value={email}
            onChange={e => {
              setEmail(e.target.value)
            }}
            placeholder="your@email.com"
            required
            disabled={status === 'loading'}
            className={styles.input}
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className={styles.btn}
          >
            {status === 'loading' ? 'Subscribing…' : 'Subscribe'}
          </button>
          {status === 'error' && <p className={styles.error}>{message}</p>}
        </form>
      )}
    </div>
  )
}
