// The mailing list is paused. Every signup block is gated on this value, so
// reading PUBLIC_NEWSLETTER_API_URL here again (a GitHub Actions secret, unset
// in local dev and forks) is what brings them back.
export const newsletterApiUrl: string | undefined = undefined
