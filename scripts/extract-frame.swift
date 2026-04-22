#!/usr/bin/env swift
import AVFoundation
import AppKit

guard CommandLine.arguments.count >= 4 else {
    fputs("usage: extract-frame.swift <input.mov> <output.png> <seconds>\n", stderr)
    exit(1)
}
let inputPath = CommandLine.arguments[1]
let outputPath = CommandLine.arguments[2]
let seconds = Double(CommandLine.arguments[3]) ?? 1.0

let asset = AVURLAsset(url: URL(fileURLWithPath: inputPath))
let gen = AVAssetImageGenerator(asset: asset)
gen.appliesPreferredTrackTransform = true
gen.requestedTimeToleranceAfter = .zero
gen.requestedTimeToleranceBefore = .zero
gen.maximumSize = CGSize(width: 720, height: 960)

let t = CMTime(seconds: seconds, preferredTimescale: 600)
do {
    let cgimg = try gen.copyCGImage(at: t, actualTime: nil)
    let rep = NSBitmapImageRep(cgImage: cgimg)
    rep.size = NSSize(width: rep.pixelsWide, height: rep.pixelsHigh)
    guard let data = rep.representation(using: .png, properties: [.compressionFactor: 0.85]) else {
        fputs("encode failed\n", stderr)
        exit(1)
    }
    try data.write(to: URL(fileURLWithPath: outputPath))
    print("ok \(outputPath) @ \(seconds)s")
} catch {
    fputs("\(error)\n", stderr)
    exit(1)
}
