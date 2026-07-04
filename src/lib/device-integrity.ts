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

// Some laptops expose a second videoinput that is NOT an external webcam — an
// infrared / depth camera used for Windows Hello face login. Counting it as an
// "extra camera" would falsely warn a huge number of honest students, so these
// are excluded from the real-camera count.
const NON_RGB_CAMERA_PATTERNS = [
  "ir camera", "infrared", "ir sensor", "ir(", " ir ", "depth", "windows hello",
]

/** True if a label looks like an IR/depth camera rather than a normal RGB webcam. */
export function isInfraredCameraLabel(label: string | null | undefined): boolean {
  if (!label) return false
  const lower = label.toLowerCase()
  return NON_RGB_CAMERA_PATTERNS.some((p) => lower.includes(p))
}

/**
 * Enumerates connected input devices of one kind and returns the labels of the
 * "real" ones — excluding known virtual devices, the OS "default"/
 * "communications" alias entries, and (for cameras) IR/depth Windows Hello
 * cameras. Device labels are only populated after the matching permission has
 * been granted, so call this only once the camera/mic check has access.
 *
 * More than one entry means an extra external device (a second webcam, a USB
 * or Bluetooth headset/mic) is attached — a common way to feed a "clean" face
 * to the proctor, or route audio help in, while the real work happens
 * off-camera.
 */
async function listRealInputDevices(kind: "videoinput" | "audioinput"): Promise<string[]> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
    return []
  }
  const devices = await navigator.mediaDevices.enumerateDevices()
  const seen = new Set<string>()
  const labels: string[] = []
  for (const d of devices) {
    if (d.kind !== kind) continue
    if (!d.deviceId || d.deviceId === "default" || d.deviceId === "communications") continue
    if (seen.has(d.deviceId)) continue
    seen.add(d.deviceId)
    if (isVirtualDeviceLabel(d.label)) continue
    if (kind === "videoinput" && isInfraredCameraLabel(d.label)) continue
    labels.push(d.label || (kind === "videoinput" ? "Unknown camera" : "Unknown microphone"))
  }
  return labels
}

/** Labels of all real (non-virtual, non-IR) cameras connected to the machine. */
export function listRealCameras(): Promise<string[]> {
  return listRealInputDevices("videoinput")
}

/** Labels of all real (non-virtual) microphones connected to the machine. */
export function listRealMicrophones(): Promise<string[]> {
  return listRealInputDevices("audioinput")
}
