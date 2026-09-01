import CoreGraphics
import Foundation

let opts: CGWindowListOption = [.optionAll, .excludeDesktopElements]
guard let list = CGWindowListCopyWindowInfo(opts, kCGNullWindowID) as? [[String: Any]] else {
  exit(1)
}
for w in list {
  let owner = w[kCGWindowOwnerName as String] as? String ?? ""
  let name = w[kCGWindowName as String] as? String ?? ""
  let num = w[kCGWindowNumber as String] as? Int ?? -1
  let layer = w[kCGWindowLayer as String] as? Int ?? -1
  let onscreen = w[kCGWindowIsOnscreen as String] as? Bool ?? false
  var b = "?"
  if let bd = w[kCGWindowBounds as String] as? [String: Any],
    let x = bd["X"] as? Double, let y = bd["Y"] as? Double,
    let width = bd["Width"] as? Double, let h = bd["Height"] as? Double
  {
    b = "\(Int(x)),\(Int(y)),\(Int(width)),\(Int(h))"
  }
  if layer == 0 && !owner.isEmpty {
    print("\(num)\t\(onscreen ? "on " : "off")\t\(b)\t\(owner)\t\(name)")
  }
}
