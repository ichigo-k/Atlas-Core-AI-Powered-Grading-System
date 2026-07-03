// Virtual camera/microphone detection — a common cheat is routing a
// pre-recorded or remotely-controlled feed through virtual device software
// (OBS Virtual Camera, ManyCam, Snap Camera, DroidCam/iVCam, VB-Audio Virtual
// Cable, VoiceMeeter, etc.) instead of a real webcam/mic.
//
// There's no cryptographic way to prove a MediaStreamTrack came from real
// hardware — a sufficiently determined spoof can rename its driver. This is a
// practical mitigation: `MediaStreamTrack.label` exposes the real device/driver
// name once permission is granted, and virtual-device software almost always
// advertises itself by name. Blocklist matching catches the overwhelming
// majority of real-world spoofing attempts for near-zero cost.

const VIRTUAL_DEVICE_PATTERNS = [
  // Virtual cameras
  "obs virtual camera", "obs-camera", "manycam", "snap camera", "snapcamera",
  "camtwist", "xsplit vcam", "splitcam", "droidcam", "ivcam", "epoccam",
  "iriun", "camo", "virtual camera", "virtualcam", "ndi virtual",
  "e2esoft", "chromacam", "youcam",
  // Virtual audio
  "vb-audio", "vb cable", "cable input", "cable output", "voicemeeter",
  "virtual audio cable", "virtual cable", "blackhole", "soundflower",
  "loopback audio", "stereo mix", "virtual mic", "virtual microphone",
]

/** True if a device/track label matches a known virtual device signature. */
export function isVirtualDeviceLabel(label: string | null | undefined): boolean {
  if (!label) return false
  const lower = label.toLowerCase()
  return VIRTUAL_DEVICE_PATTERNS.some((p) => lower.includes(p))
}

/** Checks every track in a stream; returns the label of the first virtual device found, or null. */
export function findVirtualDevice(stream: MediaStream): string | null {
  for (const track of stream.getTracks()) {
    if (isVirtualDeviceLabel(track.label)) return track.label
  }
  return null
}
