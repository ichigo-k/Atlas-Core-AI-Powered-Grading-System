"use client"

import React from "react"

const FONT_SANS = "var(--font-sans, 'Poppins', system-ui, sans-serif)"

function wordCount(text: string) {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length
}

interface WrittenInputProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  locked: boolean
}

export default function WrittenInput({
  value,
  onChange,
  locked,
}: WrittenInputProps) {
  const RULE_HEIGHT = 32
  const words = wordCount(value)
  const chars = value.length
  const lines = Math.max(12, value.split("\n").length)

  return (
    <div className="flex flex-col gap-0">
      <div className="flex items-center justify-between rounded-t-lg border border-b-0 border-[#e5e7eb] bg-[#f9fafb] px-4 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#9ca3af]" style={{ fontFamily: FONT_SANS }}>
          Written Answer
        </span>
        <span className="text-[10px] text-[#9ca3af] tabular-nums" style={{ fontFamily: FONT_SANS }}>
          {words} {words === 1 ? "word" : "words"} · {chars} chars
        </span>
      </div>

      <div className="relative rounded-b-lg border border-[#e5e7eb] bg-white overflow-hidden">
        <textarea
          value={value}
          onChange={onChange}
          disabled={locked}
          rows={lines}
          placeholder="Write your answer here…"
          className="w-full resize-none bg-transparent outline-none text-[#1f2937] placeholder-[#d1d5db] overflow-hidden px-5 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            fontFamily: FONT_SANS,
            fontSize: "15px",
            lineHeight: `${RULE_HEIGHT}px`,
            backgroundImage: `repeating-linear-gradient(
              to bottom,
              transparent,
              transparent ${RULE_HEIGHT - 1}px,
              #ebebeb ${RULE_HEIGHT - 1}px,
              #ebebeb ${RULE_HEIGHT}px
            )`,
            backgroundSize: `100% ${RULE_HEIGHT}px`,
            paddingTop: "6px",
            height: `${lines * RULE_HEIGHT}px`,
          }}
          onInput={(e) => {
            const el = e.currentTarget
            el.style.height = "0px"
            const newLines = Math.max(12, Math.ceil(el.scrollHeight / RULE_HEIGHT))
            el.style.height = `${newLines * RULE_HEIGHT}px`
          }}
        />
      </div>
    </div>
  )
}
