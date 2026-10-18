interface Band {
  key: string
  top: number
  height: number
}

export function sectionAt<T extends Band>(sections: readonly T[], y: number) {
  return sections.find(s => y < s.top + s.height) ?? sections.at(-1)
}

// The moved section lands above its target when moving up, below it when
// moving down.
export function dropLineTop(
  sections: readonly Band[],
  key: string,
  ontoKey: string,
) {
  const from = sections.findIndex(s => s.key === key)
  const to = sections.findIndex(s => s.key === ontoKey)
  const onto = sections[to]
  return from < 0 || !onto || from === to
    ? undefined
    : to < from
      ? onto.top - 1
      : onto.top + onto.height - 1
}
