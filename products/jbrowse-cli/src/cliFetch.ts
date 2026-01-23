export default function cliFetch(url: string | URL, options: RequestInit = {}) {
  return fetch(url, options)
}
