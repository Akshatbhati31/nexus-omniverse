import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { ArrowLeft, ShieldAlert } from 'lucide-react'
import { AppShell } from './components/layout/AppShell'
import { PageSkeleton } from './components/ui/Loading'
import { getRole } from './data/roles'
import { useCurrentUser, usePermission, useSessionStore } from './store/useSessionStore'
import type { Permission } from './types'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const OverviewPage = lazy(() => import('./pages/OverviewPage'))
const GeoIntPage = lazy(() => import('./pages/GeoIntPage'))
const DistrictWorkspacePage = lazy(() => import('./pages/DistrictWorkspacePage'))
const DomainWorkspacePage = lazy(() => import('./pages/DomainWorkspacePage'))
const InfrastructurePage = lazy(() => import('./pages/InfrastructurePage'))
const EnvironmentPage = lazy(() => import('./pages/EnvironmentPage'))
const EconomyPage = lazy(() => import('./pages/EconomyPage'))
const MobilityPage = lazy(() => import('./pages/MobilityPage'))
const EnergyPage = lazy(() => import('./pages/EnergyPage'))
const IncidentsPage = lazy(() => import('./pages/IncidentsPage'))
const IncidentDetailPage = lazy(() => import('./pages/IncidentDetailPage'))
const SimulationPage = lazy(() => import('./pages/SimulationPage'))
const AIPage = lazy(() => import('./pages/AIPage'))
const ArchivePage = lazy(() => import('./pages/ArchivePage'))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'))
const NetworkPage = lazy(() => import('./pages/NetworkPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const ReportDetailPage = lazy(() => import('./pages/ReportDetailPage'))
const EntityPage = lazy(() => import('./pages/EntityPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

function RequireAuth() {
  const currentUserId = useSessionStore((state) => state.currentUserId)
  const location = useLocation()
  if (!currentUserId) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const allowed = usePermission(permission)
  const user = useCurrentUser()
  const roles = useSessionStore((state) => state.roles)

  if (!allowed) {
    const role = user ? getRole(user.roleId, roles) : undefined
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-6">
        <div className="panel max-w-xl p-7">
          <div className="flex items-center gap-2 text-[var(--amber)]">
            <ShieldAlert size={17} />
            <span className="kicker text-[var(--amber)]">Access boundary</span>
          </div>
          <h1 className="mt-4 font-display text-3xl tracking-[-0.04em] text-[var(--text-bright)]">Workspace restricted.</h1>
          <p className="mt-3 text-[12px] leading-relaxed text-[var(--muted)]">
            The <span className="font-mono text-[var(--text)]">{role?.name ?? 'current'}</span> role does not carry the required permission for
            this workspace. The navigation item is hidden, and this route-level check prevents direct access.
          </p>
          <div className="mt-4 border border-[var(--line)] bg-black/25 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--muted-2)]">
            Required · {permission}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/overview" className="btn btn-primary">
              <ArrowLeft size={12} /> Return to overview
            </Link>
            <Link to="/admin" className="btn">
              Identity & access
            </Link>
          </div>
          <p className="mt-4 text-[9px] leading-relaxed text-[var(--muted-2)]">
            Client-side RBAC is a demonstration control. Production authorization is enforced by Supabase row-level security and server-side RPCs.
          </p>
        </div>
      </div>
    )
  }

  return children
}

function guard(permission: Permission, element: ReactNode) {
  return <RequirePermission permission={permission}>{element}</RequirePermission>
}

function RouteFallback() {
  return <PageSkeleton />
}

export default function App() {
  useEffect(() => {
    const unsubscribe = useSessionStore.getState().initLiveSession()
    return () => {
      unsubscribe()
    }
  }, [])

  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to="/overview" replace />} />
              <Route path="overview" element={guard('view:overview', <OverviewPage />)} />
              <Route path="overview/district/:districtId" element={guard('view:overview', <DistrictWorkspacePage />)} />
              <Route path="geoint" element={guard('view:geoint', <GeoIntPage />)} />
              <Route path="geoint/district/:districtId" element={guard('view:geoint', <DistrictWorkspacePage />)} />
              <Route path="geoint/workspace/:workspaceId" element={guard('view:geoint', <DomainWorkspacePage />)} />
              <Route path="infrastructure" element={guard('view:infrastructure', <InfrastructurePage />)} />
              <Route path="infrastructure/workspace/:workspaceId" element={guard('view:infrastructure', <DomainWorkspacePage />)} />
              <Route path="environment" element={guard('view:environment', <EnvironmentPage />)} />
              <Route path="environment/workspace/:workspaceId" element={guard('view:environment', <DomainWorkspacePage />)} />
              <Route path="economy" element={guard('view:economy', <EconomyPage />)} />
              <Route path="economy/workspace/:workspaceId" element={guard('view:economy', <DomainWorkspacePage />)} />
              <Route path="mobility" element={guard('view:mobility', <MobilityPage />)} />
              <Route path="mobility/workspace/:workspaceId" element={guard('view:mobility', <DomainWorkspacePage />)} />
              <Route path="energy" element={guard('view:energy', <EnergyPage />)} />
              <Route path="energy/workspace/:workspaceId" element={guard('view:energy', <DomainWorkspacePage />)} />
              <Route path="incidents" element={guard('view:incidents', <IncidentsPage />)} />
              <Route path="incidents/:id" element={guard('view:incidents', <IncidentDetailPage />)} />
              <Route path="simulation" element={guard('view:simulation', <SimulationPage />)} />
              <Route path="ai" element={guard('view:ai', <AIPage />)} />
              <Route path="archive" element={guard('view:archive', <ArchivePage />)} />
              <Route path="analytics" element={guard('view:analytics', <AnalyticsPage />)} />
              <Route path="network" element={guard('view:network', <NetworkPage />)} />
              <Route path="reports" element={guard('view:reports', <ReportsPage />)} />
              <Route path="reports/:id" element={guard('view:reports', <ReportDetailPage />)} />
              <Route path="entity/:id" element={guard('view:overview', <EntityPage />)} />
              <Route path="admin" element={guard('view:admin', <AdminPage />)} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
