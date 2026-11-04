import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { uid } from '../lib/utils'

export type InspectorTarget = { kind: 'entity' | 'incident' | null; id?: string }

export interface Toast {
  id: string
  title: string
  message?: string
  tone: 'info' | 'success' | 'warning' | 'danger'
}

interface UIState {
  commandOpen: boolean
  notificationsOpen: boolean
  navGroupOpen: string | null
  mobileNavOpen: boolean
  inspectorOpen: boolean
  inspectorTarget: InspectorTarget
  activeWorkspace: string
  compactDensity: boolean
  toasts: Toast[]
  openCommand: () => void
  closeCommand: () => void
  toggleCommand: () => void
  openNotifications: () => void
  closeNotifications: () => void
  toggleNotifications: () => void
  setNavGroup: (groupId: string | null) => void
  setMobileNav: (open: boolean) => void
  toggleInspector: () => void
  openInspector: (kind: 'entity' | 'incident', id: string) => void
  closeInspector: () => void
  setActiveWorkspace: (workspace: string) => void
  setCompactDensity: (compact: boolean) => void
  pushToast: (toast: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      commandOpen: false,
      notificationsOpen: false,
      navGroupOpen: null,
      mobileNavOpen: false,
      inspectorOpen: true,
      inspectorTarget: { kind: null },
      activeWorkspace: 'Aurelia Metropolitan Theater',
      compactDensity: false,
      toasts: [],
      openCommand: () => set({ commandOpen: true, notificationsOpen: false, navGroupOpen: null }),
      closeCommand: () => set({ commandOpen: false }),
      toggleCommand: () => set((state) => ({ commandOpen: !state.commandOpen, notificationsOpen: false })),
      openNotifications: () => set({ notificationsOpen: true, commandOpen: false }),
      closeNotifications: () => set({ notificationsOpen: false }),
      toggleNotifications: () =>
        set((state) => ({ notificationsOpen: !state.notificationsOpen, commandOpen: false, navGroupOpen: null })),
      setNavGroup: (groupId) => set({ navGroupOpen: groupId }),
      setMobileNav: (open) => set({ mobileNavOpen: open }),
      toggleInspector: () => set((state) => ({ inspectorOpen: !state.inspectorOpen })),
      openInspector: (kind, id) => set({ inspectorOpen: true, inspectorTarget: { kind, id } }),
      closeInspector: () => set({ inspectorOpen: false }),
      setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),
      setCompactDensity: (compact) => set({ compactDensity: compact }),
      pushToast: (toast) => {
        const entry = { ...toast, id: uid('toast') }
        set((state) => ({ toasts: [...state.toasts.slice(-3), entry] }))
        window.setTimeout(() => {
          get().dismissToast(entry.id)
        }, 4200)
      },
      dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
    }),
    {
      name: 'nexus-ui-v1',
      version: 1,
      partialize: (state) => ({
        inspectorOpen: state.inspectorOpen,
        activeWorkspace: state.activeWorkspace,
        compactDensity: state.compactDensity,
      }),
    },
  ),
)
