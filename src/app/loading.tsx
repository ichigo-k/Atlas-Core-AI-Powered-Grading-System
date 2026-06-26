export default function GlobalLoading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-white/80 backdrop-blur-sm">
      {/* Three bouncing dots */}
      <div className="flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2.5 w-2.5 rounded-full bg-[#002388]"
            style={{
              animation: "dot-bounce 1.2s ease-in-out infinite",
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      <p
        className="text-[12px] font-semibold uppercase tracking-[0.15em] text-slate-400"
        style={{ fontFamily: "var(--font-sans, 'Poppins', system-ui, sans-serif)" }}
      >
        Loading…
      </p>

      <style>{`
        @keyframes dot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
          40%            { transform: translateY(-8px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
