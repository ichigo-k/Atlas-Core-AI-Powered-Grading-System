/**
 * ProctorLiveKit — LiveKit-based WebRTC client for Oracle AI proctoring.
 *
 * Replaces the old ``ProctorWebRTC`` (aiortc signaling) class.
 * Connects to the Oracle co-located LiveKit Server using the token and URL
 * returned by the session-creation endpoint.
 *
 * Publishes only the student's video track (camera). Audio publishing is
 * intentionally disabled to preserve student privacy (Requirement 2.2).
 * The Oracle LiveKit agent subscribes to both video and audio on the server
 * side — the audio track is captured by the agent from its own subscription,
 * not published by the student directly.
 *
 * Reconnection is handled by the LiveKit SDK's built-in logic. After the SDK
 * exhausts its maximum retry attempts, the server will detect CONNECTION_LOST
 * via the grace period.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import {
  Room,
  RoomEvent,
  RoomOptions,
  Track,
  createLocalVideoTrack,
  ConnectionState,
} from 'livekit-client'

const MAX_RECONNECT_ATTEMPTS = 10

export class ProctorLiveKit {
  private room: Room
  private sessionId: string
  private attemptId: number
  private livekitToken: string
  private livekitUrl: string

  /** Increments each time the SDK fires a Reconnecting event. */
  private reconnectAttempts = 0

  /** True when disconnect() is called intentionally — suppresses warnings. */
  private intentionalDisconnect = false

  /**
   * Set when disconnect() is requested before the LiveKit room finishes
   * connecting. The actual leave happens immediately after connect resolves.
   */
  private disconnectRequestedWhileConnecting = false

  private onProctorFlag?: (type: string, confidence: number) => void

  constructor(
    sessionId: string,
    livekitToken: string,
    livekitUrl: string,
    attemptId: number,
    onProctorFlag?: (type: string, confidence: number) => void,
  ) {
    this.sessionId = sessionId
    this.livekitToken = livekitToken
    this.livekitUrl = livekitUrl
    this.attemptId = attemptId
    this.onProctorFlag = onProctorFlag

    const options: RoomOptions = {
      adaptiveStream: false,
      dynacast: false,
    }
    this.room = new Room(options)

    this._registerEventHandlers()
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Connect to the LiveKit room and publish the student's video track.
   */
  async connect(): Promise<void> {
    this.intentionalDisconnect = false
    this.disconnectRequestedWhileConnecting = false
    this.reconnectAttempts = 0

    try {
      await this.room.connect(this.livekitUrl, this.livekitToken, {
        autoSubscribe: false,
      })
    } catch (err: any) {
      if (this.intentionalDisconnect || (err && err.message && err.message.includes('Client initiated disconnect'))) {
        return
      }
      throw err
    }

    if (this.intentionalDisconnect || this.disconnectRequestedWhileConnecting) {
      try {
        this.room.disconnect()
      } catch (e) {
        // ignore
      }
      return
    }

    // Publish video track only (no audio — Requirement 2.2).
    try {
      const videoTrack = await createLocalVideoTrack({
        resolution: { width: 640, height: 480, frameRate: 15 },
      })
      if (this.intentionalDisconnect) {
        videoTrack.stop()
        return
      }
      await this.room.localParticipant.publishTrack(videoTrack, {
        source: Track.Source.Camera,
      })
    } catch (err) {
      console.error('[ProctorLiveKit] Failed to publish video track:', err)
    }
  }

  /**
   * Disconnect from the LiveKit room and stop all published tracks.
   */
  disconnect(): void {
    this.intentionalDisconnect = true

    if (this.room.state === ConnectionState.Connected) {
      try {
        this.room.disconnect()
      } catch (err) {
        // ignore
      }
    } else {
      this.disconnectRequestedWhileConnecting = true
    }
  }

  /** Returns true when the room connection is active. */
  isConnected(): boolean {
    return this.room.state === ConnectionState.Connected
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private _registerEventHandlers(): void {
    this.room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
      try {
        const str = new TextDecoder().decode(payload)
        const data = JSON.parse(str)
        if (data.type === 'PROCTOR_FLAG' && this.onProctorFlag) {
          this.onProctorFlag(data.anomaly, data.confidence)
        }
      } catch (err) {
        console.warn('[ProctorLiveKit] Failed to parse data message:', err)
      }
    })

    this.room.on(RoomEvent.Reconnecting, () => {
      this.reconnectAttempts++
      console.warn(
        `[ProctorLiveKit] Reconnecting… attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`,
      )
    })

    this.room.on(RoomEvent.Reconnected, () => {
      console.info('[ProctorLiveKit] Reconnected successfully.')
      this.reconnectAttempts = 0
    })

    this.room.on(RoomEvent.Disconnected, () => {
      if (!this.intentionalDisconnect) {
        console.warn('[ProctorLiveKit] Disconnected from proctoring server. Reconnection handled by SDK.')
      }
    })
  }
}
