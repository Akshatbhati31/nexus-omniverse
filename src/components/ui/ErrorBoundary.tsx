import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('NEXUS subsystem boundary caught an error', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center p-8">
          <div className="panel max-w-lg p-8">
            <AlertTriangle size={22} className="text-[var(--amber)]" />
            <div className="kicker mt-5">Subsystem fault isolated</div>
            <h2 className="mt-2 font-display text-2xl tracking-[-0.03em] text-[var(--text-bright)]">This workspace failed to render.</h2>
            <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
              The error boundary prevented a failure from propagating through the operating environment. You can reload the shell or return to
              the global overview.
            </p>
            <div className="mt-4 border border-[var(--line)] bg-black/30 p-3 font-mono text-[10px] text-[var(--red)]">
              {this.state.message || 'Unknown subsystem error'}
            </div>
            <div className="mt-5 flex gap-2">
              <button type="button" className="btn btn-primary" onClick={() => window.location.assign('/overview')}>
                Return to overview
              </button>
              <button type="button" className="btn" onClick={() => window.location.reload()}>
                Reload shell
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
