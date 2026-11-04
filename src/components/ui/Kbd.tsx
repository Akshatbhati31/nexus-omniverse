export function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center border border-[var(--line-strong)] bg-white/[0.035] px-1 font-mono text-[9px] text-[var(--muted)]">
      {children}
    </kbd>
  )
}
