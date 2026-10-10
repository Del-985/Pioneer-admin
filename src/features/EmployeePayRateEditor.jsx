import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../lib/api.js';

const money = cents => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD',
}).format(cents / 100);

function localToday() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Detroit', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = key => parts.find(x => x.type === key)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function centsFromInput(value) {
  const trimmed = String(value).trim();
  if (!/^(?:\d{1,6})(?:\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ''] = trimmed.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents >= 1 && cents <= 10000000 ? cents : null;
}

const messageOf = error => error instanceof Error ? error.message : 'Unable to load or save the hourly rate.';

export default function EmployeePayRateEditor({ businessUnitId, employee }) {
  const [history, setHistory] = useState([]);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [hourly, setHourly] = useState('');
  const [effectiveOn, setEffectiveOn] = useState(localToday);
  const [overtimePercent, setOvertimePercent] = useState('150');
  const [notes, setNotes] = useState('');
  const today = localToday();
  const current = history.find(rate => rate.effectiveOn <= today) || null;
  const future = history.filter(rate => rate.effectiveOn > today).reverse();

  const loadRates = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiRequest(
        `/api/admin/business-units/${businessUnitId}/payroll/rates`
      );
      const data = (Array.isArray(response.data) ? response.data : [])
        .filter(rate => rate.employeeId === employee.id)
        .sort((a, b) => b.effectiveOn.localeCompare(a.effectiveOn));
      setHistory(data);
      setPermissionDenied(false);
      const applicable = data.find(rate => rate.effectiveOn <= localToday());
      setHourly(applicable ? (applicable.hourlyCents / 100).toFixed(2) : '');
      setOvertimePercent(applicable
        ? (applicable.overtimeMultiplierBps / 100).toFixed(2) : '150');
    } catch (cause) {
      if (cause?.status === 403) {
        setPermissionDenied(true);
      } else {
        setError(messageOf(cause));
      }
    } finally {
      setLoading(false);
    }
  }, [businessUnitId, employee.id]);

  useEffect(() => {
    setHistory([]);
    setNotice('');
    setEffectiveOn(localToday());
    setNotes('');
    void loadRates();
  }, [loadRates]);

  async function saveRate() {
    const hourlyCents = centsFromInput(hourly);
    const pct = Number(overtimePercent);
    if (hourlyCents === null) {
      setError('Enter an hourly rate between $0.01 and $100,000.00, with no more than two decimal places.');
      return;
    }
    if (!Number.isFinite(pct) || pct < 100 || pct > 400 ||
      Math.round(pct * 100) !== pct * 100) {
      setError('Enter an overtime multiplier from 100% to 400%, with up to two decimal places.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await apiRequest(
        `/api/admin/business-units/${businessUnitId}/payroll/rates`, {
          method: 'POST',
          body: JSON.stringify({
            employeeId: employee.id,
            effectiveOn,
            hourlyCents,
            overtimeMultiplierBps: Math.round(pct * 100),
            notes: notes.trim() || undefined,
          }),
        }
      );
      await loadRates();
      setNotice('Hourly rate saved. The employee will see the rate when its effective date arrives.');
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  if (permissionDenied) return null;

  return (
    <section className="management-card employee-pay-rate-card" aria-label="Employee pay rate">
      <div className="section-heading-row">
        <div>
          <h2>Hourly Pay Rate — {employee.displayName}</h2>
          <p className="page-description">
            Set the employee’s hourly rate separately from their personal details.
            Rate changes feed the existing payroll system.
          </p>
        </div>
        <button className="secondary-button compact-button" type="button"
          disabled={loading || busy} onClick={() => void loadRates()}>
          {loading ? 'Loading…' : 'Refresh rates'}
        </button>
      </div>
      {error && <p role="alert" className="form-error section-error">{error}</p>}
      {notice && <p role="status" className="form-success section-error">{notice}</p>}
      {loading && !history.length ? <p className="table-secondary">Loading pay information…</p> : (
        <>
          <div className="employee-pay-rate-current">
            <div>
              <span>Current Hourly Rate</span>
              <strong>{current ? `${money(current.hourlyCents)}/hr` : 'Not set'}</strong>
              <small>{current ? `Effective ${current.effectiveOn}` :
                'The employee will not see a rate until one becomes effective.'}</small>
            </div>
            {future.length > 0 && <div>
              <span>Scheduled Rate Change{future.length > 1 ? 's' : ''}</span>
              {future.map(rate => (
                <p key={rate.id}>
                  <strong>{money(rate.hourlyCents)}/hr</strong> — {rate.effectiveOn}
                </p>
              ))}
            </div>}
          </div>
          <div className="employee-pay-rate-fields">
            <label className="field-label">
              Hourly Rate ($)
              <input aria-label="Employee hourly rate" type="number"
                min="0.01" max="100000" step="0.01" required
                value={hourly} onChange={event => setHourly(event.target.value)}
                placeholder="18.00" />
            </label>
            <label className="field-label">
              Effective Date
              <input aria-label="Hourly rate effective date" type="date" required
                value={effectiveOn} onChange={event => setEffectiveOn(event.target.value)} />
            </label>
            <label className="field-label">
              Estimated Overtime Rate (% of Hourly)
              <input aria-label="Employee overtime multiplier" type="number"
                min="100" max="400" step="0.01" required
                value={overtimePercent}
                onChange={event => setOvertimePercent(event.target.value)} />
            </label>
          </div>
          <label className="field-label">
            Rate Change Notes (Internal)
            <textarea rows={2} maxLength={1500} value={notes}
              onChange={event => setNotes(event.target.value)}
              placeholder="Optional reason for this pay rate…" />
          </label>
          <div className="row-button-group management-form-actions">
            <button className="primary-button" type="button"
              disabled={busy || loading || !hourly || !effectiveOn}
              onClick={() => void saveRate()}>
              {busy ? 'Saving Rate…' : 'Save Hourly Rate'}
            </button>
          </div>
          {history.length > 0 && <div className="employee-pay-rate-history">
            <h3>Pay Rate History</h3>
            <div className="table-wrap">
              <table className="feature-table">
                <thead><tr><th>Effective</th><th>Hourly</th><th>Overtime Factor</th></tr></thead>
                <tbody>{history.map(rate => (
                  <tr key={rate.id}>
                    <td>{rate.effectiveOn}</td>
                    <td>{money(rate.hourlyCents)}/hr</td>
                    <td>{(rate.overtimeMultiplierBps / 100).toFixed(2)}%</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>}
          <p className="table-secondary employee-pay-rate-note">
            Changes to hours already included in payroll may be restricted. Use an
            audited payroll adjustment for previously posted earnings.
          </p>
        </>
      )}
    </section>
  );
}
