import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Red de contención de último recurso. Sin esto, un error de render deja al
 * socio mirando una pantalla en blanco, sin pista de qué pasó ni cómo salir.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ui] error no capturado:', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div className="centered-viewport">
        <div className="fallback-card">
          <h1>Algo se rompió</h1>
          <p>Recargá la página. Si vuelve a pasar, avisale al staff del club.</p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Recargar
          </button>
        </div>
      </div>
    );
  }
}
