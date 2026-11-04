import { ArrowLeft, Compass, LayoutDashboard, MapPinned, RadioTower } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'

const ROUTE_HINTS = [
  {
    to: '/overview',
    label: 'Global overview',
    description: 'Return to the consolidated operating picture.',
    icon: LayoutDashboard,
  },
  {
    to: '/geoint',
    label: 'Geospatial intelligence',
    description: 'Open the city twin and district telemetry.',
    icon: MapPinned,
  },
  {
    to: '/incidents',
    label: 'Incident command',
    description: 'Review active events and command workflows.',
    icon: RadioTower,
  },
]

export default function NotFoundPage() {
  const location = useLocation()

  return (
    <div className="space-y-4">
      <PageHeader
        kicker="Navigation boundary"
        title="Coordinate not resolved"
        subtitle="The requested workspace is not part of the current operating graph. The route may have been renamed, retired, or never provisioned in this environment."
        meta={
          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted-2)]">
            Request · <span className="text-[var(--amber)]">{location.pathname}</span>
          </span>
        }
        actions={
          <Link to="/overview" className="btn btn-primary">
            <ArrowLeft size={12} /> Return to overview
          </Link>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <Panel className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-[0.18]" aria-hidden="true">
            <div className="absolute inset-0 bg-[linear-gradient(var(--line)_1px,transparent_1px),linear-gradient(90deg,var(--line)_1px,transparent_1px)] bg-[size:32px_32px]" />
            <div className="absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--cyan)]/40" />
            <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--line-strong)]" />
          </div>
          <div className="relative flex min-h-[340px] flex-col items-center justify-center px-6 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center border border-[var(--amber)]/30 bg-[var(--amber-dim)] text-[var(--amber)]">
              <Compass size={22} strokeWidth={1.4} />
            </div>
            <div className="mt-5 font-mono text-[54px] leading-none tracking-[-0.06em] text-[var(--text-bright)]">404</div>
            <div className="mt-2 font-mono text-[8px] uppercase tracking-[0.28em] text-[var(--amber)]">Signal lost</div>
            <p className="mt-4 max-w-md text-[11px] leading-relaxed text-[var(--muted)]">
              No route handler matched this address. No data was requested or exposed. Use an indexed workspace below to re-enter the
              environment.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link to="/overview" className="btn btn-primary">
                <ArrowLeft size={12} /> Overview
              </Link>
              <Link to="/geoint" className="btn">
                <MapPinned size={12} /> City twin
              </Link>
            </div>
          </div>
        </Panel>

        <Panel>
          <div className="border-b border-[var(--line)] px-4 py-3">
            <div className="label-micro mb-1">Indexed workspaces</div>
            <h2 className="font-display text-[13px] font-medium text-[var(--text-bright)]">Re-enter the operating graph</h2>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {ROUTE_HINTS.map((hint) => (
              <Link key={hint.to} to={hint.to} className="group flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.025]">
                <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center border border-[var(--line)] bg-white/[0.02] text-[var(--muted)] transition-colors group-hover:border-[var(--cyan)]/40 group-hover:text-[var(--cyan)]">
                  <hint.icon size={14} strokeWidth={1.5} />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-[12px] font-medium text-[var(--text)] group-hover:text-[var(--text-bright)]">{hint.label}</span>
                  <span className="mt-1 block text-[9.5px] leading-relaxed text-[var(--muted-2)]">{hint.description}</span>
                </span>
              </Link>
            ))}
          </div>
          <div className="border-t border-[var(--line)] px-4 py-3">
            <p className="text-[8.5px] leading-relaxed text-[var(--muted-2)]">
              Routes are permission-gated. If a workspace exists but is not visible to your role, switch identity from the profile menu or
              request elevated access through an administrator.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  )
}
