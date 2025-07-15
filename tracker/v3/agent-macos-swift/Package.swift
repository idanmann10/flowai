// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "tracker-agent",
    platforms: [
        .macOS(.v10_15)
    ],
    dependencies: [
        // Add any external dependencies here if needed
    ],
    targets: [
        .executableTarget(
            name: "tracker-agent",
            dependencies: [],
            path: "Sources"
        ),
        .testTarget(
            name: "tracker-agentTests",
            dependencies: ["tracker-agent"],
            path: "Tests"
        ),
    ]
)
