export async function fetchJson<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    throw new Error(
      `HTTP ${res.status} fetching ${url}: ${await res.text().catch(() => '')}`,
    )
  }
  return (await res.json()) as T
}
