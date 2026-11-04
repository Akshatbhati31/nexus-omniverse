import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useUIStore } from '../../store/useUIStore'

const toneMap = {
  info: { icon: Info, color: 'var(--cyan)' },
  success: { icon: CheckCircle2, color: 'var(--green)' },
  warning: { icon: AlertTriangle, color: 'var(--amber)' },
  danger: { icon: XCircle, color: 'var(--red)' },
}

export function ToastStack() {
  const toasts = useUIStore((state) => state.toasts)
  const dismissToast = useUIStore((state) => state.dismissToast)

  return (
    <div className="pointer-events-none fixed bottom-10 right-4 z-[90] flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const tone = toneMap[toast.tone]
          const Icon = tone.icon
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 24, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
              className="pointer-events-auto border border-[var(--line-strong)] bg-[rgba(8,13,19,0.97)] p-3 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl"
            >
              <div className="flex gap-2.5">
                <Icon size={14} style={{ color: tone.color }} className="mt-0.5 flex-none" />
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[12px] font-medium text-[var(--text-bright)]">{toast.title}</div>
                  {toast.message ? <div className="mt-1 text-[10px] leading-relaxed text-[var(--muted)]">{toast.message}</div> : null}
                </div>
                <button type="button" className="text-[var(--muted-2)] hover:text-white" onClick={() => dismissToast(toast.id)} aria-label="Dismiss notification">
                  <X size={13} />
                </button>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
