import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom'
import './index.css'
import { useActiveOrg, useStore } from './store'
import { Layout } from './components/Layout'
import { Overview } from './pages/Overview'
import { Invoices } from './pages/Invoices'
import { InvoiceDetail } from './pages/InvoiceDetail'
import { Credit } from './pages/Credit'
import { Marketplace } from './pages/Marketplace'
import { Esg } from './pages/Esg'
import { Accounting } from './pages/Accounting'
import { DataSources } from './pages/DataSources'
import { SettingsPage } from './pages/Settings'
import { Admin } from './pages/Admin'
import { AuthPage, DevChooser } from './pages/AuthPage'

function Home() {
  const org = useActiveOrg()
  return org.type === 'fcc' ? <Navigate to="/admin" replace /> : <Overview />
}

const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'admin', element: <Admin /> },
      { path: 'invoices', element: <Invoices /> },
      { path: 'invoices/:id', element: <InvoiceDetail /> },
      { path: 'credit', element: <Credit /> },
      { path: 'credit/:orgId', element: <Credit /> },
      { path: 'marketplace', element: <Marketplace /> },
      { path: 'esg', element: <Esg /> },
      { path: 'esg/:orgId', element: <Esg /> },
      { path: 'accounting', element: <Accounting /> },
      { path: 'data', element: <DataSources /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])

function Boot() {
  const ready = useStore((s) => s.ready)
  const checked = useStore((s) => s.checked)
  const error = useStore((s) => s.error)
  const dev = useStore((s) => s.dev)
  useEffect(() => {
    void useStore.getState().boot()
  }, [])
  if (ready) return <RouterProvider router={router} />
  if (checked) return dev ? <DevChooser /> : <AuthPage />
  return (
    <div className="grid h-full place-items-center p-6 text-center text-sm text-ink-2">
      {error ? (
        <div className="max-w-md space-y-3">
          <p className="font-semibold text-critical-ink">{error}</p>
          <button className="cursor-pointer rounded-lg border border-line px-4 py-2" onClick={() => void useStore.getState().boot()}>
            Thử lại
          </button>
        </div>
      ) : (
        'Đang tải…'
      )}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Boot />
  </StrictMode>,
)
