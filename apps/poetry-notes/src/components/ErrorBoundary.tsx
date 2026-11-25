import { Component, type ReactNode, type ErrorInfo } from 'react';
import { ReportProblemButton } from '@repo/feedback';
import { supabase } from '../integrations/supabase/client';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('Uncaught render error:', error, info.componentStack);
    }

    render() {
        if (this.state.error) {
            return (
                <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'system-ui' }}>
                    <h2>Something went wrong</h2>
                    <p>Please refresh the page. If the problem persists, let us know.</p>
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                        <button onClick={() => this.setState({ error: null })}>Try again</button>
                        {/* Sits above every provider, so it submits on its own (no FeedbackProvider). */}
                        <ReportProblemButton
                            supabase={supabase}
                            appKey="poetry-notes"
                            appName="Poetry Notes"
                            error={this.state.error}
                        />
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
