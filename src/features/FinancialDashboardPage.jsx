import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useCompany } from '../context/CompanyContext.jsx';
import { apiRequest } from '../lib/api.js';

const PERIODS = [
  { value: 'month', label: 'Month to date' },
  { value: 'year', label: 'Year to date' },
  { value: 'all', label: 'All time' },
];

const moneyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

function formatMoney(cents) {
  const value = Number(cents);
  return moneyFormatter.format(Number.isFinite(value) ? value / 100 : 0);
}

function toDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getRange(period) {
  if (period === 'all') return { from: null, to: null };

  const today = new Date();
  const from = period === 'year'
    ? new Date(today.getFullYear(), 0, 1)
    : new Date(today.getFullYear(), today.getMonth(), 1);

  return {
    from: toDateString(from),
    to: toDateString(today),
  };
}

function rangeLabel(period, range) {
  if (period === 'all') return 'All posted activity';
  return `${range.from} through ${range.to}`;
}

export function FinancialDashboardPage() {
  const { selectedCompanyId, selectCompany } = useCompany();
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const range = useMemo(() => getRange(period), [period]);

  const loadFinancials = useCallback(async ({ background = false } = {}) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (range.from) params.set('from', range.from);
      if (range.to) params.set('to', range.to);
      const query = params.toString();
      const payload = await apiRequest(`/api/admin/reporting/consolidated${query ? `?${query}` : ''}`);
      setData(payload?.data || null);
      setLastUpdated(new Date());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load financial overview.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    void loadFinancials();
  }, [loadFinancials]);

  useEffect(() => {
    function refreshOnFocus() {
      void loadFinancials({ background: true });
    }

    function refreshWhenVisible() {
      if (document.visibilityState === 'visible') {
        void loadFinancials({ background: true });
      }
    }

    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [loadFinancials]);

  const totals = data?.totals || {};
  const businessRows = Array.isArray(data?.businessUnits) ? data.businessUnits : [];
  const outstandingInvoicesCents = Math.max(
    0,
    Number(totals.invoiceTotalCents || 0) - Number(totals.invoicePaidCents || 0),
  );

  return (
    <section className="page-panel dashboard-page">
      <div className="dashboard-header">
        <div className="dashboard-heading-copy">
          <p className="eyebrow">Pioneer Legacy Works</p>
          <h1>Financial overview</h1>
          <p className="page-description">
            A consolidated view of posted financial activity across every business you can access.
          </p>
        </div>

        <div className="dashboard-workspace">
          <label className="field-label" htmlFor="dashboard-period">Period</label>
          <select id="dashboard-period" value={period} onChange={(event) => setPeriod(event.target.value)}>
            {PERIODS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button
            className="secondary-button"
            type="button"
            disabled={loading || refreshing}
            onClick={() => void loadFinancials({ background: true })}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="lead-summary" aria-label="Financial reporting period">
        <span><strong>Period:</strong> {rangeLabel(period, range)}</span>
        <span><strong>Source:</strong> Posted bookkeeping records</span>
        <span><strong>Scope:</strong> All accessible businesses</span>
        <span>
          <strong>Updated:</strong>{' '}
          {lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Loading'}
        </span>
      </div>

      {error && (
        <p className="form-error section-error">
          {error}
        </p>
      )}

      {loading ? (
        <p className="loading-copy">Loading financial overview…</p>
      ) : data ? (
        <>
          <div className="metric-grid dashboard-metrics">
            <article className="metric-card">
              <span>Posted revenue</span>
              <strong>{formatMoney(totals.postedRevenueCents)}</strong>
              <small>Recognized revenue</small>
            </article>
            <article className="metric-card">
              <span>Posted expenses</span>
              <strong>{formatMoney(totals.postedExpensesCents)}</strong>
              <small>Recognized expenses</small>
            </article>
            <article className="metric-card">
              <span>Net operating</span>
              <strong>{formatMoney(totals.netOperatingCents)}</strong>
              <small>Revenue less expenses</small>
            </article>
            <article className="metric-card">
              <span>Payments collected</span>
              <strong>{formatMoney(totals.paymentsCents)}</strong>
              <small>Completed payments</small>
            </article>
            <article className="metric-card">
              <span>Outstanding invoices</span>
              <strong>{formatMoney(outstandingInvoicesCents)}</strong>
              <small>Invoiced less paid</small>
            </article>
          </div>

          <section className="data-section">
            <div className="section-heading-row">
              <div>
                <h2>Businesses</h2>
                <p className="section-subtitle">
                  Each row comes directly from that business unit&apos;s bookkeeping and invoice records.
                </p>
              </div>
              <a className="secondary-link" href="https://books.pioneerlegacyworks.com">
                Open Pioneer Bookkeeping
              </a>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Business</th>
                    <th>Revenue</th>
                    <th>Expenses</th>
                    <th>Net</th>
                    <th>Payments</th>
                    <th>Outstanding</th>
                    <th>Workspace</th>
                  </tr>
                </thead>
                <tbody>
                  {businessRows.map(({ businessUnit, summary }) => {
                    const outstanding = Math.max(
                      0,
                      Number(summary?.invoices?.totalCents || 0) - Number(summary?.invoices?.paidCents || 0),
                    );
                    const selected = selectedCompanyId === businessUnit.id;

                    return (
                      <tr key={businessUnit.id}>
                        <td>
                          <strong>{businessUnit.name}</strong>
                          <br />
                          <small>{businessUnit.legalEntity?.name || businessUnit.legalEntity?.displayName || 'Pioneer Legacy Works'}</small>
                        </td>
                        <td>{formatMoney(summary?.postedRevenueCents)}</td>
                        <td>{formatMoney(summary?.postedExpensesCents)}</td>
                        <td>{formatMoney(summary?.netOperatingCents)}</td>
                        <td>{formatMoney(summary?.paymentsCents)}</td>
                        <td>{formatMoney(outstanding)}</td>
                        <td>
                          <button
                            className="text-button"
                            type="button"
                            disabled={selected}
                            onClick={() => selectCompany(businessUnit.id)}
                          >
                            {selected ? 'Selected' : 'Select business'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {businessRows.length === 0 && (
                    <tr>
                      <td colSpan="7" className="empty-cell">No accessible business units have reporting data yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="dashboard-shortcuts" aria-labelledby="financial-shortcuts-title">
            <div>
              <span className="dashboard-section-label">Administration</span>
              <h2 id="financial-shortcuts-title">Financial controls</h2>
            </div>
            <div className="dashboard-shortcut-grid">
              <a href="https://books.pioneerlegacyworks.com">
                <strong>Bookkeeping</strong>
                <span>Enter, post, reconcile, and review transactions</span>
              </a>
              <NavLink to="/companies">
                <strong>Companies</strong>
                <span>Manage business units and company configuration</span>
              </NavLink>
            </div>
          </section>
        </>
      ) : null}
    </section>
  );
}
