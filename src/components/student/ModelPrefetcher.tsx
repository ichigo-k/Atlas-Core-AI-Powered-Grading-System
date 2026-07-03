"use client"

/**
 * ModelPrefetcher — quietly warms the shared ML model cache (see
 * src/lib/model-cache.ts) as soon as the student area mounts, well before
 * the student ever opens an exam. Mounted once in the persistent student
 * layout shell so it fires right after login.
 *
 * Scheduled via requestIdleCallback so it never competes with anything the
 * student is actively doing (falls back to a 2s setTimeout on browsers
 * without requestIdleCallback, e.g. Safari).
 *
 * Renders nothing.
 */

import { useEffect } from "react"
import { prefetchModels } from "@/lib/model-cache"

export default function ModelPrefetcher() {
  useEffect(() => {
    let idleId: number | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void) => number)
      | undefined
    const cic = (window as any).cancelIdleCallback as
      | ((id: number) => void)
      | undefined

    if (ric) {
      idleId = ric(() => prefetchModels())
    } else {
      timeoutId = setTimeout(() => prefetchModels(), 2000)
    }

    return () => {
      if (idleId !== null && cic) cic(idleId)
      if (timeoutId !== null) clearTimeout(timeoutId)
    }
  }, [])

  return null
}
