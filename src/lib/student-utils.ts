import { createHash } from 'crypto'

export type DerivedStatus = 'upcoming' | 'ongoing' | 'completed'

type FilterableAssessment = {
  courseId: number
  type: string
  title: string
  course: { title: string }
}

export function deriveStatus(startsAt: Date, endsAt: Date, now: Date): DerivedStatus {
  if (now < startsAt) return 'upcoming'
  if (now <= endsAt) return 'ongoing'
  return 'completed'
}

export function computeAverage(scores: (number | null)[]): number | null {
  const nonNull = scores.filter((s): s is number => s !== null)
  if (nonNull.length === 0) return null
  const avg = nonNull.reduce((sum, s) => sum + s, 0) / nonNull.length
  return Math.round(avg * 100) / 100
}

export function sortAndLimit<T>(items: T[], key: keyof T, dir: 'asc' | 'desc', n: number): T[] {
  return [...items]
    .sort((a, b) => {
      const av = a[key]
      const bv = b[key]
      if (av < bv) return dir === 'asc' ? -1 : 1
      if (av > bv) return dir === 'asc' ? 1 : -1
      return 0
    })
    .slice(0, n)
}

export function applyFilters<T extends FilterableAssessment>(
  assessments: T[],
  filters: { courseId?: number; type?: string; search?: string },
): T[] {
  return assessments.filter((a: any) => {
    if (filters.courseId !== undefined && a.courseId !== filters.courseId) return false
    if (filters.type !== undefined && a.type !== filters.type) return false
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (!a.title.toLowerCase().includes(q) && !a.course.title.toLowerCase().includes(q)) return false
    }
    return true
  })
}

export function shuffleWithSeed(ids: number[]): number[] {
  const arr = [...ids]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// Server-only — never import in "use client" files
export function computeHash(value: string | null): string | null {
  if (value === null) return null
  return createHash('sha256').update(value).digest('hex')
}

export function computeRemaining(startedAt: Date, durationMinutes: number, now: Date): number {
  return startedAt.getTime() + durationMinutes * 60 * 1000 - now.getTime()
}
