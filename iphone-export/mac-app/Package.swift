// swift-tools-version:5.9
// iPhone Export for Mac.
// ExportCore is plain Foundation (runs and tests on any platform); the SwiftUI app target only builds on macOS.
import PackageDescription

var products: [Product] = [.library(name: "ExportCore", targets: ["ExportCore"])]
var targets: [Target] = [
    .target(name: "ExportCore"),
    .testTarget(name: "ExportCoreTests", dependencies: ["ExportCore"]),
]

#if os(macOS)
products.append(.executable(name: "iPhoneExport", targets: ["iPhoneExport"]))
targets.append(.executableTarget(name: "iPhoneExport", dependencies: ["ExportCore"]))
#endif

let package = Package(
    name: "iPhoneExport",
    platforms: [.macOS(.v13)],
    products: products,
    targets: targets
)
