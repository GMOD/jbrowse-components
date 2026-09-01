import CoreGraphics
import Foundation

let src = CGEventSource(stateID: .hidSystemState)

func post(_ e: CGEvent?) {
  e?.post(tap: .cghidEventTap)
  usleep(12000)
}

func click(_ x: Double, _ y: Double) {
  let p = CGPoint(x: x, y: y)
  post(CGEvent(mouseEventSource: src, mouseType: .mouseMoved, mouseCursorPosition: p, mouseButton: .left))
  usleep(80000)
  post(CGEvent(mouseEventSource: src, mouseType: .leftMouseDown, mouseCursorPosition: p, mouseButton: .left))
  usleep(40000)
  post(CGEvent(mouseEventSource: src, mouseType: .leftMouseUp, mouseCursorPosition: p, mouseButton: .left))
}

func typeText(_ s: String) {
  // One event per chunk keeps long prompts from outrunning the target's input
  // handling; a whole prompt in a single event drops characters.
  for chunk in Array(s).chunked(into: 8) {
    let str = String(chunk)
    let down = CGEvent(keyboardEventSource: src, virtualKey: 0, keyDown: true)
    let up = CGEvent(keyboardEventSource: src, virtualKey: 0, keyDown: false)
    var utf16 = Array(str.utf16)
    down?.keyboardSetUnicodeString(stringLength: utf16.count, unicodeString: &utf16)
    up?.keyboardSetUnicodeString(stringLength: utf16.count, unicodeString: &utf16)
    post(down)
    post(up)
    usleep(14000)
  }
}

func key(_ code: CGKeyCode, cmd: Bool) {
  let down = CGEvent(keyboardEventSource: src, virtualKey: code, keyDown: true)
  let up = CGEvent(keyboardEventSource: src, virtualKey: code, keyDown: false)
  if cmd {
    down?.flags = .maskCommand
    up?.flags = .maskCommand
  }
  post(down)
  usleep(30000)
  post(up)
}

extension Array {
  func chunked(into size: Int) -> [[Element]] {
    stride(from: 0, to: count, by: size).map { Array(self[$0..<Swift.min($0 + size, count)]) }
  }
}

let args = Array(CommandLine.arguments.dropFirst())
switch args.first {
case "click":
  click(Double(args[1])!, Double(args[2])!)
case "type":
  typeText(args[1])
case "key":
  key(CGKeyCode(UInt16(args[1])!), cmd: args.count > 2 && args[2] == "cmd")
default:
  FileHandle.standardError.write("usage: inputtool click X Y | type TEXT | key CODE [cmd]\n".data(using: .utf8)!)
  exit(2)
}
