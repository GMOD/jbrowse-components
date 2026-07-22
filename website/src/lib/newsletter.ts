// Unset in local dev and forks (it's a GitHub Actions secret), in which case
// every newsletter block is omitted rather than rendered as a dead form.
export const newsletterApiUrl = import.meta.env.PUBLIC_NEWSLETTER_API_URL as
  string | undefined
