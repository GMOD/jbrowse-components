// A small inline legend tying a swatch color to its meaning. Rendered alongside
// the sequence so e.g. transl_except highlights are self-explanatory. Styles are
// inline (not classes) so the legend survives copy-paste to an external document.
export default function SequenceLegend({
  items,
}: {
  items: { color: string; label: string }[]
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        fontSize: 11,
        fontStyle: 'italic',
      }}
    >
      {items.map(({ color, label }) => (
        <span
          key={label}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              background: color,
              border: '1px solid #999',
            }}
          />
          {label}
        </span>
      ))}
    </div>
  )
}
