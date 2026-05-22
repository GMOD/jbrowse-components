export default function nextTickMod() {
  return new Promise(
    resolve => requestAnimationFrame(resolve) || setTimeout(resolve, 1),
  )
}
