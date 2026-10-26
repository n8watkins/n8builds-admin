'use client'

import { Component, type ReactNode } from 'react'
import { PanelError } from './ui'

/** Keeps one panel's render failure from taking down the dashboard. */
export class PanelBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? <PanelError message="Something went wrong rendering it; the server log has the details." /> : this.props.children
  }
}
