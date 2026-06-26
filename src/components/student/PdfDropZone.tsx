"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Upload, FileText } from "lucide-react"

const FONT_SANS = "var(--font-sans, 'Poppins', system-ui, sans-serif)"

interface PdfDropZoneProps {
  onFile: (file: File) => void
  error: string | null
  locked: boolean
  existingFileUrl?: string | null
  uploading: boolean
}

export default function PdfDropZone({
  onFile,
  error,
  locked,
  existingFileUrl,
  uploading,
}: PdfDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    if (existingFileUrl) {
      const parts = existingFileUrl.split("/")
      const lastPart = parts[parts.length - 1]
      const match = lastPart.match(/^attempt_\d+_q_\d+_\d+_(.*)$/)
      if (match) {
        setFileName(match[1])
      } else {
        setFileName(lastPart)
      }
    } else {
      setFileName(null)
    }
  }, [existingFileUrl])

  function processFile(file: File) {
    setFileName(file.name)
    onFile(file)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!locked && !uploading) setIsDragging(true)
  }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (locked || uploading) return
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function handleBrowse() {
    if (locked || uploading) return
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {}).finally(() => inputRef.current?.click())
    } else {
      inputRef.current?.click()
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    }
    if (!file) return
    processFile(file)
    e.target.value = ""
  }

  if (uploading) {
    return (
      <div className="relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-[#002388] px-8 py-12 text-center bg-[#f8fafc] animate-pulse">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#eef2ff]">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#002388] border-t-transparent" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-[15px] font-semibold text-[#002388]" style={{ fontFamily: FONT_SANS }}>
            Uploading your PDF...
          </p>
          <p className="text-[12px] text-[#6b7280]" style={{ fontFamily: FONT_SANS }}>
            Please wait while we secure your file in storage.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <input ref={inputRef} type="file" accept=".pdf" className="sr-only" onChange={handleChange} tabIndex={-1} />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          "relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-8 py-12 text-center transition-all duration-150 select-none",
          locked
            ? "opacity-50 cursor-not-allowed border-[#e5e7eb] bg-[#fafafa]"
            : isDragging
            ? "border-[#002388] bg-[#eef2ff] scale-[1.01]"
            : fileName
            ? "border-[#16a34a] bg-[#f0fdf4]"
            : "border-[#d1d5db] bg-[#fafafa] hover:border-[#002388] hover:bg-[#f8faff] cursor-default",
        ].join(" ")}
      >
        <div className={[
          "flex h-14 w-14 items-center justify-center rounded-full transition-colors",
          isDragging ? "bg-[#dbeafe]" : fileName ? "bg-[#dcfce7]" : "bg-[#f3f4f6]",
        ].join(" ")}>
          {fileName
            ? <Check size={24} className="text-[#16a34a]" strokeWidth={2.5} />
            : isDragging
            ? <Upload size={24} className="text-[#002388]" strokeWidth={2} />
            : <FileText size={24} className="text-[#6b7280]" strokeWidth={1.5} />
          }
        </div>

        {fileName ? (
          <div className="flex flex-col items-center gap-1">
            <p className="text-[14px] font-semibold text-[#15803d]" style={{ fontFamily: FONT_SANS }}>
              File attached
            </p>
            <p className="text-[12px] text-[#6b7280] break-all max-w-xs" style={{ fontFamily: FONT_SANS }}>
              {fileName}
            </p>
            {!locked && (
              <button
                type="button"
                onClick={handleBrowse}
                className="mt-1 text-[12px] text-[#002388] hover:underline font-medium"
                style={{ fontFamily: FONT_SANS }}
              >
                Replace file
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <p className="text-[15px] font-semibold text-[#374151]" style={{ fontFamily: FONT_SANS }}>
              {isDragging ? "Drop your PDF here" : "Drag your PDF here"}
            </p>
            <p className="text-[12px] text-[#9ca3af]" style={{ fontFamily: FONT_SANS }}>
              PDF files only · max 10 MB
            </p>
            {!locked && (
              <button
                type="button"
                onClick={handleBrowse}
                className="mt-2 text-[12px] text-[#002388] hover:underline font-medium"
                style={{ fontFamily: FONT_SANS }}
              >
                or browse to upload
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-[#dc2626]" style={{ fontFamily: FONT_SANS }}>
          {error}
        </p>
      )}
    </div>
  )
}
