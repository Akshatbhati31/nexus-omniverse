import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useGlobalShortcuts } from '../../hooks/useGlobalShortcuts'
import { CommandPalette } from '../command/CommandPalette'
import { NotificationCenter } from '../notifications/NotificationCenter'
import { ErrorBoundary } from '../ui/ErrorBoundary'
import { PageSkeleton } from '../ui/Loading'
import { ToastStack } from '../ui/ToastStack'
import { ContextInspector } from './ContextInspector'
import { MobileNav } from './MobileNav'
import { SidebarRail } from './SidebarRail'
import { StatusBar } from './StatusBar'
import { TopBar } from './TopBar'

export function AppShell() {
  const location = useLocation()
  const reduceMotion = useReducedMotion()
  useGlobalShortcuts()

  return (
    <div className="flex h-[100dvh] min-h-[520px] flex-col overflow-hidden">
      <div className="app-background" />
      <a
        href="#nexus-main"
        className="fixed left-2 top-2 z-[100] -translate-y-20 bg-[var(--cyan)] px-3 py-2 font-mono text-[10px] text-black focus:translate-y-0"
      >
        Skip to workspace
      </a>
      <div className="flex min-h-0 flex-1">
        <SidebarRail />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <div className="flex min-h-0 flex-1">
            <main id="nexus-main" className="relative min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
              <ErrorBoundary>
                <Suspense fallback={<PageSkeleton />}>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={location.pathname}
                      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                      transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                      className="min-h-full"
                    >
                      <Outlet />
                    </motion.div>
                  </AnimatePresence>
                </Suspense>
              </ErrorBoundary>
            </main>
            <ContextInspector />
          </div>
          <StatusBar />
        </div>
      </div>
      <CommandPalette />
      <NotificationCenter />
      <MobileNav />
      <ToastStack />
    </div>
  )
}
