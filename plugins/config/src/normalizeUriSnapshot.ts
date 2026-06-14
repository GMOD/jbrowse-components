// allows a minimal config of `{ uri: "..." }` by lifting `uri`/`baseUri` into
// a proper `location` fileLocation slot. Shared by the alias adapters.
export function normalizeUriSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        location: {
          uri: snap.uri,
          baseUri: snap.baseUri,
        },
      }
    : snap
}
