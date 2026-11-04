import { useState, type ReactNode } from 'react'
import { Check, Copy, Download, Info, MoreHorizontal } from 'lucide-react'
import type { ChartDataset } from '../../types'
import { csvFromRows, downloadFile } from '../../lib/utils'
import { Panel, PanelHeader } from '../ui/Panel'

interface ChartFrameProps {
  title: string
  source?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  dataset?: ChartDataset
  footer?: ReactNode
  exportName?: string
}

export function ChartFrame({ title, source, actions, children, className, dataset, footer, exportName }: ChartFrameProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)

  const handleExport = () => {
    if (!dataset) return
    downloadFile(`${exportName ?? dataset.id}.csv`, csvFromRows(dataset.data))
    setMenuOpen(false)
  }

  const handleCopyJSON = () => {
    if (!dataset) return
    navigator.clipboard?.writeText(JSON.stringify(dataset, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    setMenuOpen(false)
  }

  return (
    <Panel className={className}>
      <PanelHeader
        title={title}
        eyebrow={source}
        action={
          <div className="relative flex items-center gap-1">
            {actions}
            {dataset ? (
              <button type="button" className="icon-btn" onClick={handleExport} aria-label="Export chart data as CSV" title="Export CSV">
                <Download size={13} />
              </button>
            ) : null}
            <button
              type="button"
              className="icon-btn"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Chart options"
              title="Chart options"
              aria-expanded={menuOpen}
            >
              <MoreHorizontal size={14} />
            </button>

            {menuOpen ? (
              <div
                className="absolute right-0 top-full z-30 mt-1 min-w-[160px] border border-[var(--line-strong)] bg-[#070d14] p-1 shadow-2xl backdrop-blur-md"
                onMouseLeave={() => setMenuOpen(false)}
              >
                {dataset ? (
                  <>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[9.5px] text-[var(--text)] transition-colors hover:bg-[var(--cyan-dim)] hover:text-[var(--cyan)]"
                      onClick={handleExport}
                    >
                      <Download size={11} />
                      Export CSV ({dataset.data.length} rows)
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[9.5px] text-[var(--text)] transition-colors hover:bg-[var(--cyan-dim)] hover:text-[var(--cyan)]"
                      onClick={handleCopyJSON}
                    >
                      {copied ? <Check size={11} className="text-[var(--green)]" /> : <Copy size={11} />}
                      {copied ? 'Dataset copied' : 'Copy dataset JSON'}
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[9.5px] text-[var(--text)] transition-colors hover:bg-[var(--cyan-dim)] hover:text-[var(--cyan)]"
                  onClick={() => {
                    setInfoOpen((v) => !v)
                    setMenuOpen(false)
                  }}
                >
                  <Info size={11} />
                  {infoOpen ? 'Hide telemetry info' : 'View telemetry info'}
                </button>
              </div>
            ) : null}
          </div>
        }
      />
      {infoOpen && dataset ? (
        <div className="border-b border-[var(--line)] bg-[rgba(86,225,255,0.03)] px-3 py-2 font-mono text-[8px] text-[var(--muted)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>ID: {dataset.id} · Unit: {dataset.unit || 'dimensionless'} · Series: {dataset.series.map((s) => s.label).join(', ')}</span>
            <span className="text-[var(--cyan)]">{dataset.data.length} data points sampled</span>
          </div>
        </div>
      ) : null}
      <div className="p-3 pt-4">{children}</div>
      {footer ? <div className="border-t border-[var(--line)] px-4 py-2.5">{footer}</div> : null}
    </Panel>
  )
}
