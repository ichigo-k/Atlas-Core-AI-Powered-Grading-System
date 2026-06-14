export default function StudentFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t" style={{ borderColor: "#D5DBDB", backgroundColor: "#FAFAFA" }}>
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-10 flex items-center justify-between gap-4">
        <p className="text-xs" style={{ color: "#94A3B8" }}>
          © {year} GCTU. All rights reserved.
        </p>
        <div className="flex items-center gap-4">
          {["Privacy Policy", "Help Desk", "Contact"].map((item) => (
            <a key={item} href="#" className="text-xs transition-colors hover:text-[#002388]" style={{ color: "#94A3B8" }}>
              {item}
            </a>
          ))}
        </div>
      </div>
    </footer>
  )
}
