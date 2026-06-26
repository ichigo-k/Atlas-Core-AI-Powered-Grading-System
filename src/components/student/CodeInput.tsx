"use client"

import { Highlight, themes } from "prism-react-renderer"
import { ChevronDown } from "lucide-react"

const FONT_MONO = "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace"
const FONT_SIZE = 13.5
const LINE_HEIGHT = 22
const GUTTER_W = 44
const PAD_V = 16

const EDITOR_BG = "#f6f8fa"
const EDITOR_GUTTER_BG = "#eef0f3"
const EDITOR_GUTTER_FG = "#8c959f"
const EDITOR_BORDER = "#d0d7de"
const EDITOR_CARET = "#24292f"

export type SupportedLang = "python" | "javascript" | "typescript" | "java" | "c" | "cpp" | "sql" | "go" | "rust" | "html" | "css"

export const LANGUAGES: { value: SupportedLang; label: string }[] = [
  { value: "python",     label: "Python"     },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "java",       label: "Java"       },
  { value: "c",          label: "C"          },
  { value: "cpp",        label: "C++"        },
  { value: "sql",        label: "SQL"        },
  { value: "go",         label: "Go"         },
  { value: "rust",       label: "Rust"       },
  { value: "html",       label: "HTML"       },
  { value: "css",        label: "CSS"        },
]

interface CodeInputProps {
  value: string
  onChange: (v: string) => void
  language: SupportedLang
  onLanguageChange: (l: SupportedLang) => void
}

export default function CodeInput({
  value,
  onChange,
  language,
  onLanguageChange,
}: CodeInputProps) {
  const MIN_LINES = 14
  const lineCount = Math.max(MIN_LINES, value.split("\n").length + 1)
  const displayCode = value ? (value.endsWith("\n") ? value + " " : value) : " "

  const sharedStyle: React.CSSProperties = {
    fontFamily: FONT_MONO,
    fontSize: `${FONT_SIZE}px`,
    lineHeight: `${LINE_HEIGHT}px`,
    padding: `${PAD_V}px ${PAD_V}px ${PAD_V}px ${GUTTER_W}px`,
    margin: 0,
    whiteSpace: "pre",
    wordBreak: "normal",
    overflowWrap: "normal",
    tabSize: 2,
  }

  const lineNumberStyle: React.CSSProperties = {
    display: "inline-block",
    width: `${GUTTER_W - PAD_V - 8}px`,
    marginLeft: `-${GUTTER_W - PAD_V}px`,
    marginRight: "8px",
    textAlign: "right",
    color: EDITOR_GUTTER_FG,
    userSelect: "none",
    fontVariantNumeric: "tabular-nums",
  }

  const lineLen = value.split("\n").length
  const charLen = value.length

  return (
    <div className="flex flex-col gap-0">
      <div
        className="flex items-center justify-between gap-3 rounded-t-lg border border-b-0 px-3 py-1.5"
        style={{ background: EDITOR_GUTTER_BG, borderColor: EDITOR_BORDER }}
      >
        <div className="flex items-center gap-1.5">
          {["#ff5f57", "#febc2e", "#28c840"].map((c: any) => (
            <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
          ))}
        </div>

        <div className="relative">
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value as SupportedLang)}
            className="appearance-none rounded border border-[#d0d7de] bg-white pl-2.5 pr-6 py-0.5 text-[11px] font-semibold text-[#24292f] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#002388]"
            style={{ fontFamily: FONT_MONO }}
          >
            {LANGUAGES.map((l: any) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
          <ChevronDown size={10} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[#57606a]" />
        </div>
      </div>

      <div
        className="relative rounded-b-lg"
        style={{
          background: EDITOR_BG,
          border: `1px solid ${EDITOR_BORDER}`,
          backgroundImage: `linear-gradient(to right, ${EDITOR_GUTTER_BG} ${GUTTER_W}px, ${EDITOR_BG} ${GUTTER_W}px)`,
        }}
      >
        <Highlight theme={themes.github} code={displayCode} language={language}>
          {({ tokens, getLineProps, getTokenProps }) => (
            <pre
              aria-hidden="true"
              className="pointer-events-none select-none absolute inset-0 overflow-hidden rounded-b-lg"
              style={{ ...sharedStyle, background: "transparent", margin: 0 }}
            >
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })} style={{ display: "block" }}>
                  <span style={lineNumberStyle}>{i + 1}</span>
                  {line.map((token, j) => <span key={j} {...getTokenProps({ token })} />)}
                </div>
              ))}
            </pre>
          )}
        </Highlight>

        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="Write your code here…"
          rows={lineCount}
          className="relative w-full resize-none outline-none block rounded-b-lg"
          style={{
            ...sharedStyle,
            background: "transparent",
            color: "transparent",
            caretColor: EDITOR_CARET,
            overflow: "hidden",
            WebkitTextFillColor: "transparent",
          }}
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              e.preventDefault()
              const el = e.currentTarget
              const s = el.selectionStart
              const end = el.selectionEnd
              const indent = "  "
              const next = value.substring(0, s) + indent + value.substring(end)
              onChange(next)
              requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + indent.length })
            }
          }}
        />
      </div>

      <div
        className="flex items-center justify-end gap-4 rounded-b border-x border-b px-3 py-1"
        style={{ background: EDITOR_GUTTER_BG, borderColor: EDITOR_BORDER, borderTopColor: "transparent" }}
      >
        <span className="text-[10px] tabular-nums" style={{ color: EDITOR_GUTTER_FG, fontFamily: FONT_MONO }}>
          {lineLen} {lineLen === 1 ? "line" : "lines"} · {charLen} chars
        </span>
      </div>
    </div>
  )
}
