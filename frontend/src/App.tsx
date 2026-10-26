import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchCategories, updateTransactionCategory, uploadStatement } from './api'
import type { CategorizeResponse, CategorizedTransaction } from './types'
import './App.css'

function formatMoney(amount: number): string {
  const sign = amount < 0 ? '-' : amount > 0 ? '+' : ''
  return `${sign}$${Math.abs(amount).toFixed(2)}`
}

function effectiveCategory(tx: CategorizedTransaction): string {
  return tx.user_category ?? tx.category
}

function App() {
  const [categories, setCategories] = useState<string[]>([])
  const [result, setResult] = useState<CategorizeResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'review'>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {})
  }, [])

  const onFile = useCallback(async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setLoading(true)
    try {
      const data = await uploadStatement(file)
      setResult(data)
      setFilter(data.needs_review_count > 0 ? 'review' : 'all')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const onCategoryChange = async (txId: string, category: string) => {
    setUpdatingId(txId)
    setError(null)
    try {
      const data = await updateTransactionCategory(txId, category)
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setUpdatingId(null)
    }
  }

  const visibleRows = useMemo(() => {
    if (!result) return []
    if (filter === 'review') {
      return result.transactions.filter((t) => effectiveCategory(t) === 'Needs Review')
    }
    return result.transactions
  }, [result, filter])

  const deductibleTotal = useMemo(() => {
    if (!result) return 0
    const skip = new Set(['Transfer / Not Spending', 'Refund', 'Needs Review'])
    return result.transactions
      .filter((t) => !skip.has(effectiveCategory(t)))
      .reduce((sum, t) => sum + t.amount, 0)
  }, [result])

  return (
    <div className="app">
      <header className="header">
        <div>
          <p className="eyebrow">Tax prep · Freelance designer</p>
          <h1>Statement Categorizer</h1>
          <p className="subtitle">
            Upload a business credit card CSV. Rule-based matching assigns categories; uncertain rows go to{' '}
            <strong>Needs Review</strong>.
          </p>
        </div>
      </header>

      <section className="upload-panel">
        <label className="upload-label">
          <input
            type="file"
            accept=".csv"
            disabled={loading}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <span>{loading ? 'Processing…' : 'Choose CSV statement'}</span>
        </label>
        <p className="hint">
          Try <code>sample_data/freelance_designer_statement.csv</code> from the repo (fake data only).
        </p>
        {error && <p className="error">{error}</p>}
      </section>

      {result && (
        <>
          <section className="stats">
            <div className="stat-card">
              <span className="stat-label">Transactions</span>
              <span className="stat-value">{result.transactions.length}</span>
            </div>
            <div className="stat-card warn">
              <span className="stat-label">Needs review</span>
              <span className="stat-value">{result.needs_review_count}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Est. deductible spend</span>
              <span className="stat-value">{formatMoney(deductibleTotal)}</span>
            </div>
          </section>

          <section className="summaries">
            <h2>Category totals</h2>
            <div className="summary-grid">
              {result.summaries.map((s) => (
                <div key={s.category} className="summary-item">
                  <span className="summary-name">{s.category}</span>
                  <span className="summary-meta">
                    {s.count} rows · {formatMoney(s.total)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="table-section">
            <div className="table-toolbar">
              <h2>Transactions</h2>
              <div className="filters">
                <button
                  type="button"
                  className={filter === 'all' ? 'active' : ''}
                  onClick={() => setFilter('all')}
                >
                  All
                </button>
                <button
                  type="button"
                  className={filter === 'review' ? 'active' : ''}
                  onClick={() => setFilter('review')}
                >
                  Needs review only
                </button>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Category</th>
                    <th>Confidence</th>
                    <th>Why</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((tx) => {
                    const cat = effectiveCategory(tx)
                    const needsReview = cat === 'Needs Review'
                    return (
                      <tr key={tx.id} className={needsReview ? 'row-review' : ''}>
                        <td>{tx.date}</td>
                        <td>{tx.description}</td>
                        <td className={tx.amount > 0 ? 'credit' : ''}>{formatMoney(tx.amount)}</td>
                        <td>
                          <select
                            value={cat}
                            disabled={updatingId === tx.id}
                            onChange={(e) => onCategoryChange(tx.id, e.target.value)}
                          >
                            {categories.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <span className={`badge conf-${tx.confidence}`}>{tx.confidence}</span>
                        </td>
                        <td className="reason">{tx.reason}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export default App
