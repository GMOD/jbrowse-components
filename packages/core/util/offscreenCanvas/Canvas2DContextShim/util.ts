import Color from 'color'

export function splitColor(color?: string) {
  const fill = Color(color)
  return { hex: fill.hex(), opacity: fill.alpha() }
}

// https://stackoverflow.com/a/5620441/2129219
export function parseFont(font: string) {
  let fontFamily = undefined
  let fontSize = undefined
  let fontStyle = 'normal'
  let fontWeight = 'normal'
  let fontVariant = 'normal'
  let lineHeight = 'normal'

  const elements = font.split(/\s+/)
  let element
  outer: while ((element = elements.shift())) {
    switch (element) {
      case 'normal':
        break

      case 'italic':
      case 'oblique':
        fontStyle = element
        break

      case 'small-caps':
        fontVariant = element
        break

      case 'bold':
      case 'bolder':
      case 'lighter':
      case '100':
      case '200':
      case '300':
      case '400':
      case '500':
      case '600':
      case '700':
      case '800':
      case '900':
        fontWeight = element
        break

      default:
        if (!fontSize) {
          const parts = element.split('/')
          fontSize = parts[0]
          if (parts.length > 1) {
            lineHeight = parts[1]
          }
          break
        }

        fontFamily = element
        if (elements.length) {
          fontFamily += ` ${elements.join(' ')}`
        }
        break outer
    }
  }

  return {
    fontStyle,
    fontVariant,
    fontWeight,
    fontSize,
    lineHeight,
    fontFamily,
  }
}
