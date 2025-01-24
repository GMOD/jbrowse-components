export function randomColor(str: string) {
  let sum = 0

  for (let i = 0; i < str.length; i++) {
    sum += str.charCodeAt(i)
  }
  return `hsl(${sum * 10}, 20%, 50%)`
}
