/**
 * model-cache — shared, module-level singleton cache for heavy client-side
 * ML models (MediaPipe FaceLandmarker, TensorFlow COCO-SSD, TensorFlow
 * BlazeFace).
 *
 * These models are expensive to load (network fetch of model weights +
 * building the inference graph), so every consumer across the app must
 * share ONE instance instead of loading its own copy on mount. Each getter
 * memoizes an in-flight/resolved promise at module scope: the first caller
 * triggers the load, every other caller (whether before or after it
 * resolves) awaits that same promise — never a duplicate load.
 *
 * Client-only. Do not import from server components / server actions.
 */

import type { FaceLandmarker as FaceLandmarkerType, GestureRecognizer as GestureRecognizerType } from "@mediapipe/tasks-vision"
import type * as cocoSsd from "@tensorflow-models/coco-ssd"
import type * as blazeface from "@tensorflow-models/blazeface"

let faceLandmarkerPromise: Promise<FaceLandmarkerType> | null = null
let gestureRecognizerPromise: Promise<GestureRecognizerType> | null = null
let cocoSsdPromise: Promise<cocoSsd.ObjectDetection> | null = null
let blazeFacePromise: Promise<blazeface.BlazeFaceModel> | null = null

// ── MediaPipe Face Landmarker (GPU with CPU fallback) ───────────────────────
export function getFaceLandmarker(): Promise<FaceLandmarkerType> {
  if (!faceLandmarkerPromise) {
    faceLandmarkerPromise = (async () => {
      const vision = await import("@mediapipe/tasks-vision")
      const { FaceLandmarker, FilesetResolver } = vision

      const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      )

      return FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU",
        },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: "VIDEO",
        numFaces: 2,
      }).catch(async () => {
        // GPU unavailable — fall back to CPU silently
        return FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "CPU",
          },
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          runningMode: "VIDEO",
          numFaces: 2,
        })
      })
    })().catch((err) => {
      // Allow a future call to retry after a failed load.
      faceLandmarkerPromise = null
      throw err
    })
  }
  return faceLandmarkerPromise
}

// ── MediaPipe Gesture Recognizer (hand gestures — used by the liveness check) ─
export function getGestureRecognizer(): Promise<GestureRecognizerType> {
  if (!gestureRecognizerPromise) {
    gestureRecognizerPromise = (async () => {
      const vision = await import("@mediapipe/tasks-vision")
      const { GestureRecognizer, FilesetResolver } = vision

      const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      )

      const make = (delegate: "GPU" | "CPU") =>
        GestureRecognizer.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
            delegate,
          },
          runningMode: "VIDEO",
          numHands: 1,
        })

      // GPU with silent CPU fallback (mirrors getFaceLandmarker).
      return make("GPU").catch(() => make("CPU"))
    })().catch((err) => {
      gestureRecognizerPromise = null
      throw err
    })
  }
  return gestureRecognizerPromise
}

// ── TensorFlow COCO-SSD (object detection) ──────────────────────────────────
export function getCocoSsd(): Promise<cocoSsd.ObjectDetection> {
  if (!cocoSsdPromise) {
    cocoSsdPromise = (async () => {
      const tf = await import("@tensorflow/tfjs")
      await tf.ready()
      const ssd = await import("@tensorflow-models/coco-ssd")
      return ssd.load()
    })().catch((err) => {
      cocoSsdPromise = null
      throw err
    })
  }
  return cocoSsdPromise
}

// ── TensorFlow BlazeFace (lightweight face presence check) ──────────────────
export function getBlazeFace(): Promise<blazeface.BlazeFaceModel> {
  if (!blazeFacePromise) {
    blazeFacePromise = (async () => {
      const tf = await import("@tensorflow/tfjs")
      await tf.ready()
      const bf = await import("@tensorflow-models/blazeface")
      return bf.load()
    })().catch((err) => {
      blazeFacePromise = null
      throw err
    })
  }
  return blazeFacePromise
}

// ── Prefetch all three, fire-and-forget ─────────────────────────────────────
// Safe to call multiple times: each getter's own memoization ensures no
// duplicate loads regardless of how many times prefetchModels() runs.
export function prefetchModels(): void {
  void getFaceLandmarker().catch(() => { })
  void getGestureRecognizer().catch(() => { })
  void getCocoSsd().catch(() => { })
  void getBlazeFace().catch(() => { })
}
