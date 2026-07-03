// Lightweight cross-component proctor signals.
//
// ProctorAudio and ProctorCamera run independently, but some checks need data
// from both (e.g. "mouth is moving but the mic is silent" → possible silent
// mouthing). Sharing through Zustand would cause high-frequency re-renders, so
// this is a plain mutable module singleton: the audio loop writes, the camera
// loop reads. No React involved.
export const proctorSignals = {
  /** Most recent audio RMS (0–1). Updated by ProctorAudio every analysis tick. */
  audioRms: 0,
  /** Convenience flag: true when audio is effectively silent. */
  get audioSilent() {
    return this.audioRms < 0.02
  },
  /** Live camera stream owned by ProctorCamera (null until started / after cleanup). */
  cameraStream: null as MediaStream | null,
  /** Live mic stream owned by ProctorAudio (null until started / after cleanup). */
  micStream: null as MediaStream | null,
}
