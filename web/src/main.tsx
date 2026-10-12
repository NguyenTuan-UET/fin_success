import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import { useStore } from './store'
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

const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Overview /> },
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
  const error = useStore((s) => s.error)
  useEffect(() => {
    void useStore.getState().boot()
  }, [])
  if (ready) return <RouterProvider router={router} />
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
        'Đang tải dữ liệu từ máy chủ…'
      )}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Boot />
  </StrictMode>,
)
