import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useCompany } from '../context/CompanyContext.jsx';
import { apiRequest } from '../lib/api.js';

const SCHEDULE_STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const BOOKING_STATUSES = [
  { value: '', label: 'All requests' },
  { value: 'requested', label: 'Requested' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'declined', label: 'Declined' },
  { value: 'cancelled', label: 'Cancelled' },
];

const SERVICE_TYPES = [
  { value: 'snow-removal', label: 'Snow removal' },
  { value: 'sidewalk-clearing', label: 'Sidewalk clearing' },
  { value: 'salting', label: 'Salting' },
  { value: 'snow-and-ice', label: 'Snow & ice service' },
  { value: 'outdoor-service', label: 'Outdoor service' },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad(value) {
  return String(value).padStart(2, '0');
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthGrid(anchor) {
  const first = startOfMonth(anchor);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

function monthWindow(anchor) {
  const days = monthGrid(anchor);
  const from = new Date(days[0]);
  from.setHours(0, 0, 0, 0);
  const to = new Date(days[days.length - 1]);
  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString(), days };
}

function localParts(value) {
  const date = new Date(value);
  return {
    date: dateKey(date),
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

function toIso(date, time) {
  return new Date(`${date}T${time || '00:00'}:00`).toISOString();
}

function formatMonth(anchor) {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(anchor);
}

function formatDayHeading(key) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${key}T12:00:00`));
}

function formatTime(value, allDay = false) {
  if (allDay) return 'All day';
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function nullable(value) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function serviceLabel(value) {
  return SERVICE_TYPES.find((item) => item.value === value)?.label || value;
}

function defaultEntryForm(day = dateKey(new Date())) {
  return {
    title: '',
    customerId: '',
    assignedUserId: '',
    entryType: 'service',
    date: day,
    startTime: '08:00',
    endTime: '09:00',
    allDay: false,
    status: 'scheduled',
    description: '',
  };
}

function defaultSlotForm(day = dateKey(new Date())) {
  return {
    date: day,
    startTime: '08:00',
    endTime: '09:00',
    capacity: '1',
    serviceTypes: ['snow-removal', 'sidewalk-clearing', 'salting', 'snow-and-ice'],
    status: 'open',
  };
}

export function SchedulePage() {
  const { selectedCompany, features } = useCompany();
  const feature = features.find((item) => item.key === 'scheduling');
  const [tab, setTab] = useState('calendar');
  const [anchor, setAnchor] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [statusFilter, setStatusFilter] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState('');
  const [entries, setEntries] = useState([]);
  const [slots, setSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busyId, setBusyId] = useState('');

  const [entryEditorOpen, setEntryEditorOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [entryForm, setEntryForm] = useState(() => defaultEntryForm());
  const [savingEntry, setSavingEntry] = useState(false);

  const [slotEditorOpen, setSlotEditorOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [slotForm, setSlotForm] = useState(() => defaultSlotForm());
  const [savingSlot, setSavingSlot] = useState(false);

  const range = useMemo(() => monthWindow(anchor), [anchor]);

  const loadReferenceData = useCallback(async () => {
    if (!selectedCompany) return;
    const [customerPayload, userPayload] = await Promise.all([
      apiRequest(`/api/admin/business-units/${selectedCompany.id}/customers?status=active&limit=200`),
      apiRequest('/api/admin/users'),
    ]);
    setCustomers(Array.isArray(customerPayload?.data) ? customerPayload.data : []);
    setUsers((Array.isArray(userPayload?.data) ? userPayload.data : []).filter((user) => user.status !== 'inactive'));
  }, [selectedCompany]);

  const loadSchedule = useCallback(async () => {
    if (!selectedCompany) return;
    const params = new URLSearchParams({ from: range.from, to: range.to, limit: '500' });
    if (statusFilter) params.set('status', statusFilter);
    const payload = await apiRequest(`/api/admin/business-units/${selectedCompany.id}/schedule?${params}`);
    setEntries(Array.isArray(payload?.data) ? payload.data : []);
  }, [selectedCompany, range.from, range.to, statusFilter]);

  const loadSlots = useCallback(async () => {
    if (!selectedCompany) return;
    const params = new URLSearchParams({ from: range.from, to: range.to });
    const payload = await apiRequest(`/api/admin/business-units/${selectedCompany.id}/customer-portal/availability?${params}`);
    setSlots(Array.isArray(payload?.data?.slots) ? payload.data.slots : []);
  }, [selectedCompany, range.from, range.to]);

  const loadBookings = useCallback(async () => {
    if (!selectedCompany) return;
    const params = new URLSearchParams({ from: range.from, to: range.to, limit: '200' });
    if (bookingStatusFilter) params.set('status', bookingStatusFilter);
    const payload = await apiRequest(`/api/admin/business-units/${selectedCompany.id}/customer-portal/bookings?${params}`);
    setBookings(Array.isArray(payload?.data?.bookings) ? payload.data.bookings : []);
  }, [selectedCompany, range.from, range.to, bookingStatusFilter]);

  const refreshAll = useCallback(async () => {
    if (!selectedCompany) return;
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadReferenceData(), loadSchedule(), loadSlots(), loadBookings()]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load scheduling data.');
    } finally {
      setLoading(false);
    }
  }, [selectedCompany, loadReferenceData, loadSchedule, loadSlots, loadBookings]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    setEntryEditorOpen(false);
    setEditingEntry(null);
    setSlotEditorOpen(false);
    setEditingSlot(null);
    setSuccess('');
  }, [selectedCompany?.id]);

  const customerMap = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );
  const userMap = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  const entriesByDay = useMemo(() => {
    const map = new Map();
    entries.forEach((entry) => {
      const key = dateKey(new Date(entry.startsAt));
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(entry);
    });
    return map;
  }, [entries]);

  const selectedEntries = entriesByDay.get(selectedDate) || [];
  const monthEntries = entries.filter((entry) => {
    const start = new Date(entry.startsAt);
    return start.getMonth() === anchor.getMonth() && start.getFullYear() === anchor.getFullYear();
  });
  const scheduledCount = monthEntries.filter((entry) => entry.status === 'scheduled').length;
  const completedCount = monthEntries.filter((entry) => entry.status === 'completed').length;
  const requestedBookings = bookings.filter((booking) => booking.status === 'requested').length;

  if (!selectedCompany || !feature?.enabled) {
    return <Navigate to="/dashboard" replace />;
  }

  function moveMonth(offset) {
    setAnchor((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  function goToday() {
    const today = new Date();
    setAnchor(startOfMonth(today));
    setSelectedDate(dateKey(today));
  }

  function selectDay(day) {
    const key = dateKey(day);
    setSelectedDate(key);
    if (day.getMonth() !== anchor.getMonth() || day.getFullYear() !== anchor.getFullYear()) {
      setAnchor(startOfMonth(day));
    }
  }

  function openCreateEntry(day = selectedDate) {
    setEditingEntry(null);
    setEntryForm(defaultEntryForm(day));
    setEntryEditorOpen(true);
    setSuccess('');
  }

  function openEditEntry(entry) {
    const start = localParts(entry.startsAt);
    const end = entry.endsAt ? localParts(entry.endsAt) : { time: '' };
    setEditingEntry(entry);
    setEntryForm({
      title: entry.title || '',
      customerId: entry.customerId || '',
      assignedUserId: entry.assignedUserId || '',
      entryType: entry.entryType || 'service',
      date: start.date,
      startTime: start.time,
      endTime: end.time,
      allDay: Boolean(entry.allDay),
      status: entry.status || 'scheduled',
      description: entry.description || '',
    });
    setEntryEditorOpen(true);
    setSuccess('');
  }

  function closeEntryEditor() {
    setEntryEditorOpen(false);
    setEditingEntry(null);
  }

  async function saveEntry(event) {
    event.preventDefault();
    setSavingEntry(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        customerId: entryForm.customerId || null,
        assignedUserId: entryForm.assignedUserId || null,
        title: entryForm.title.trim(),
        description: nullable(entryForm.description),
        entryType: entryForm.entryType.trim() || 'service',
        startsAt: toIso(entryForm.date, entryForm.allDay ? '00:00' : entryForm.startTime),
        endsAt: entryForm.allDay
          ? toIso(entryForm.date, '23:59')
          : entryForm.endTime
            ? toIso(entryForm.date, entryForm.endTime)
            : null,
        allDay: entryForm.allDay,
        status: entryForm.status,
      };

      if (editingEntry) {
        await apiRequest(`/api/admin/business-units/${selectedCompany.id}/schedule/${editingEntry.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest(`/api/admin/business-units/${selectedCompany.id}/schedule`, {
          method: 'POST',
          body: JSON.stringify({ ...payload, metadata: { source: 'admin-calendar' } }),
        });
      }

      setSelectedDate(entryForm.date);
      closeEntryEditor();
      await loadSchedule();
      setSuccess(editingEntry ? 'Schedule entry updated.' : 'Schedule entry created.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save schedule entry.');
    } finally {
      setSavingEntry(false);
    }
  }

  async function updateEntryStatus(entry, status) {
    setBusyId(entry.id);
    setError('');
    try {
      await apiRequest(`/api/admin/business-units/${selectedCompany.id}/schedule/${entry.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await loadSchedule();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update schedule entry.');
    } finally {
      setBusyId('');
    }
  }

  function openCreateSlot() {
    setEditingSlot(null);
    setSlotForm(defaultSlotForm(selectedDate));
    setSlotEditorOpen(true);
    setSuccess('');
  }

  function openEditSlot(slot) {
    const start = localParts(slot.startsAt);
    const end = localParts(slot.endsAt);
    setEditingSlot(slot);
    setSlotForm({
      date: start.date,
      startTime: start.time,
      endTime: end.time,
      capacity: String(slot.capacity || 1),
      serviceTypes: Array.isArray(slot.serviceTypes) ? slot.serviceTypes : [],
      status: slot.status || 'open',
    });
    setSlotEditorOpen(true);
    setSuccess('');
  }

  function toggleServiceType(serviceType) {
    setSlotForm((current) => ({
      ...current,
      serviceTypes: current.serviceTypes.includes(serviceType)
        ? current.serviceTypes.filter((item) => item !== serviceType)
        : [...current.serviceTypes, serviceType],
    }));
  }

  async function saveSlot(event) {
    event.preventDefault();
    setSavingSlot(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        startsAt: toIso(slotForm.date, slotForm.startTime),
        endsAt: toIso(slotForm.date, slotForm.endTime),
        capacity: Number(slotForm.capacity),
        serviceTypes: slotForm.serviceTypes,
      };

      if (editingSlot) {
        await apiRequest(`/api/admin/business-units/${selectedCompany.id}/customer-portal/availability/${editingSlot.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ ...payload, status: slotForm.status }),
        });
      } else {
        await apiRequest(`/api/admin/business-units/${selectedCompany.id}/customer-portal/availability`, {
          method: 'POST',
          body: JSON.stringify({ ...payload, metadata: { source: 'admin-schedule' } }),
        });
      }

      setSlotEditorOpen(false);
      setEditingSlot(null);
      await loadSlots();
      setSuccess(editingSlot ? 'Availability window updated.' : 'Availability window published to the customer portal.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save availability.');
    } finally {
      setSavingSlot(false);
    }
  }

  async function toggleSlotStatus(slot) {
    setBusyId(slot.id);
    setError('');
    try {
      await apiRequest(`/api/admin/business-units/${selectedCompany.id}/customer-portal/availability/${slot.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: slot.status === 'open' ? 'closed' : 'open' }),
      });
      await loadSlots();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update availability.');
    } finally {
      setBusyId('');
    }
  }

  async function updateBooking(booking, status) {
    setBusyId(booking.id);
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/api/admin/business-units/${selectedCompany.id}/customer-portal/bookings/${booking.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await Promise.all([loadBookings(), loadSlots(), loadSchedule()]);
      setSuccess(status === 'confirmed' ? 'Booking confirmed and added to the operating schedule.' : 'Booking updated.');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update booking.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <section className="page-panel schedule-page">
      <p className="eyebrow">{selectedCompany.name}</p>
      <div className="page-heading-row schedule-page-heading">
        <div>
          <h1>Scheduling</h1>
          <p className="page-description">Run the operating calendar, publish customer booking windows, and handle incoming booking requests.</p>
        </div>
        <button className="primary-button page-action-button" type="button" onClick={() => openCreateEntry()}>
          Add schedule item
        </button>
      </div>

      <div className="schedule-summary">
        <article><span>This month</span><strong>{monthEntries.length}</strong><small>schedule items</small></article>
        <article><span>Scheduled</span><strong>{scheduledCount}</strong><small>still upcoming / active</small></article>
        <article><span>Completed</span><strong>{completedCount}</strong><small>finished this month</small></article>
        <article><span>Booking requests</span><strong>{requestedBookings}</strong><small>awaiting action in this view</small></article>
      </div>

      <div className="schedule-tabs" role="tablist" aria-label="Scheduling sections">
        <button className={tab === 'calendar' ? 'active' : ''} type="button" onClick={() => setTab('calendar')}>Calendar</button>
        <button className={tab === 'availability' ? 'active' : ''} type="button" onClick={() => setTab('availability')}>Customer availability</button>
        <button className={tab === 'bookings' ? 'active' : ''} type="button" onClick={() => setTab('bookings')}>Booking requests{requestedBookings ? ` (${requestedBookings})` : ''}</button>
      </div>

      <div className="schedule-toolbar">
        <div className="calendar-navigation">
          <button className="secondary-button compact-button" type="button" onClick={() => moveMonth(-1)}>Previous</button>
          <button className="secondary-button compact-button" type="button" onClick={goToday}>Today</button>
          <button className="secondary-button compact-button" type="button" onClick={() => moveMonth(1)}>Next</button>
          <strong>{formatMonth(anchor)}</strong>
        </div>
        <div className="schedule-toolbar-actions">
          {tab === 'calendar' && (
            <label className="filter-field schedule-filter">
              <span>Status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                {SCHEDULE_STATUSES.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          )}
          {tab === 'bookings' && (
            <label className="filter-field schedule-filter">
              <span>Status</span>
              <select value={bookingStatusFilter} onChange={(event) => setBookingStatusFilter(event.target.value)}>
                {BOOKING_STATUSES.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          )}
          {tab === 'availability' && <button className="primary-button compact-action" type="button" onClick={openCreateSlot}>Publish availability</button>}
          <button className="secondary-button compact-action" type="button" disabled={loading} onClick={() => void refreshAll()}>{loading ? 'Refreshing…' : 'Refresh'}</button>
        </div>
      </div>

      {error && <p className="form-error section-error">{error}</p>}
      {success && <p className="form-success section-error">{success}</p>}

      {entryEditorOpen && (
        <form className="schedule-editor" onSubmit={saveEntry}>
          <div className="editor-heading">
            <div><span className="editor-kicker">{editingEntry ? 'Edit schedule item' : 'New schedule item'}</span><h2>{editingEntry?.title || 'Schedule details'}</h2></div>
            <button className="text-button" type="button" onClick={closeEntryEditor}>Close</button>
          </div>
          <div className="form-grid schedule-form-grid">
            <label className="form-field full-width"><span>Title</span><input value={entryForm.title} onChange={(event) => setEntryForm((current) => ({ ...current, title: event.target.value }))} required /></label>
            <label className="form-field"><span>Customer</span><select value={entryForm.customerId} onChange={(event) => setEntryForm((current) => ({ ...current, customerId: event.target.value }))}><option value="">No customer / internal item</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.displayName}</option>)}</select></label>
            <label className="form-field"><span>Assigned user</span><select value={entryForm.assignedUserId} onChange={(event) => setEntryForm((current) => ({ ...current, assignedUserId: event.target.value }))}><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.displayName || user.email}</option>)}</select></label>
            <label className="form-field"><span>Type</span><select value={entryForm.entryType} onChange={(event) => setEntryForm((current) => ({ ...current, entryType: event.target.value }))}><option value="service">Service</option><option value="estimate">Estimate / site visit</option><option value="work">Work</option><option value="admin">Internal / admin</option><option value="other">Other</option></select></label>
            <label className="form-field"><span>Status</span><select value={entryForm.status} onChange={(event) => setEntryForm((current) => ({ ...current, status: event.target.value }))}>{SCHEDULE_STATUSES.filter((item) => item.value).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label className="form-field"><span>Date</span><input type="date" value={entryForm.date} onChange={(event) => setEntryForm((current) => ({ ...current, date: event.target.value }))} required /></label>
            <label className="schedule-checkbox"><input type="checkbox" checked={entryForm.allDay} onChange={(event) => setEntryForm((current) => ({ ...current, allDay: event.target.checked }))} /><span>All-day item</span></label>
            {!entryForm.allDay && <label className="form-field"><span>Start time</span><input type="time" value={entryForm.startTime} onChange={(event) => setEntryForm((current) => ({ ...current, startTime: event.target.value }))} required /></label>}
            {!entryForm.allDay && <label className="form-field"><span>End time</span><input type="time" value={entryForm.endTime} onChange={(event) => setEntryForm((current) => ({ ...current, endTime: event.target.value }))} /></label>}
            <label className="form-field full-width"><span>Description / work notes</span><textarea rows="4" value={entryForm.description} onChange={(event) => setEntryForm((current) => ({ ...current, description: event.target.value }))} /></label>
          </div>
          <div className="editor-actions"><button className="secondary-button" type="button" onClick={closeEntryEditor}>Cancel</button><button className="primary-button" type="submit" disabled={savingEntry}>{savingEntry ? 'Saving…' : editingEntry ? 'Save changes' : 'Add to schedule'}</button></div>
        </form>
      )}

      {slotEditorOpen && tab === 'availability' && (
        <form className="schedule-editor availability-editor" onSubmit={saveSlot}>
          <div className="editor-heading">
            <div><span className="editor-kicker">{editingSlot ? 'Edit customer availability' : 'Publish customer availability'}</span><h2>{editingSlot ? formatDateTime(editingSlot.startsAt) : 'New booking window'}</h2></div>
            <button className="text-button" type="button" onClick={() => { setSlotEditorOpen(false); setEditingSlot(null); }}>Close</button>
          </div>
          <div className="form-grid schedule-form-grid">
            <label className="form-field"><span>Date</span><input type="date" value={slotForm.date} onChange={(event) => setSlotForm((current) => ({ ...current, date: event.target.value }))} required /></label>
            <label className="form-field"><span>Capacity</span><input type="number" min="1" max="100" value={slotForm.capacity} onChange={(event) => setSlotForm((current) => ({ ...current, capacity: event.target.value }))} required /></label>
            <label className="form-field"><span>Start time</span><input type="time" value={slotForm.startTime} onChange={(event) => setSlotForm((current) => ({ ...current, startTime: event.target.value }))} required /></label>
            <label className="form-field"><span>End time</span><input type="time" value={slotForm.endTime} onChange={(event) => setSlotForm((current) => ({ ...current, endTime: event.target.value }))} required /></label>
            {editingSlot && <label className="form-field"><span>Visibility</span><select value={slotForm.status} onChange={(event) => setSlotForm((current) => ({ ...current, status: event.target.value }))}><option value="open">Open to customers</option><option value="closed">Closed</option></select></label>}
            <fieldset className="service-type-fieldset full-width"><legend>Services customers can request</legend><p>Leave every option unchecked to allow any supported service.</p><div className="service-type-options">{SERVICE_TYPES.map((service) => <label key={service.value}><input type="checkbox" checked={slotForm.serviceTypes.includes(service.value)} onChange={() => toggleServiceType(service.value)} /><span>{service.label}</span></label>)}</div></fieldset>
          </div>
          <div className="editor-actions"><button className="secondary-button" type="button" onClick={() => { setSlotEditorOpen(false); setEditingSlot(null); }}>Cancel</button><button className="primary-button" type="submit" disabled={savingSlot}>{savingSlot ? 'Saving…' : editingSlot ? 'Save availability' : 'Publish to customer portal'}</button></div>
        </form>
      )}

      {tab === 'calendar' && (
        <div className="schedule-layout">
          <div className="calendar-shell">
            <div className="calendar-weekdays">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
            <div className="calendar-grid">
              {range.days.map((day) => {
                const key = dateKey(day);
                const dayEntries = entriesByDay.get(key) || [];
                const outside = day.getMonth() !== anchor.getMonth();
                const today = key === dateKey(new Date());
                const selected = key === selectedDate;
                return (
                  <div key={key} className={`calendar-day${outside ? ' outside' : ''}${today ? ' today' : ''}${selected ? ' selected' : ''}`}>
                    <button className="calendar-date-button" type="button" onClick={() => selectDay(day)} aria-label={`View ${formatDayHeading(key)}`}>{day.getDate()}</button>
                    <div className="calendar-day-events">
                      {dayEntries.slice(0, 3).map((entry) => <button key={entry.id} type="button" className={`calendar-event status-${entry.status}`} onClick={() => openEditEntry(entry)} title={entry.title}><span>{formatTime(entry.startsAt, entry.allDay)}</span><strong>{entry.title}</strong></button>)}
                      {dayEntries.length > 3 && <button className="calendar-more" type="button" onClick={() => selectDay(day)}>+{dayEntries.length - 3} more</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="day-agenda">
            <div className="day-agenda-heading"><div><span className="editor-kicker">Selected day</span><h2>{formatDayHeading(selectedDate)}</h2></div><button className="secondary-button compact-button" type="button" onClick={() => openCreateEntry(selectedDate)}>Add item</button></div>
            <div className="day-agenda-list">
              {selectedEntries.map((entry) => {
                const customer = customerMap.get(entry.customerId);
                const assigned = userMap.get(entry.assignedUserId);
                return <article key={entry.id} className={`agenda-item status-${entry.status}`}><button className="agenda-main" type="button" onClick={() => openEditEntry(entry)}><span className="agenda-time">{formatTime(entry.startsAt, entry.allDay)}{entry.endsAt && !entry.allDay ? ` – ${formatTime(entry.endsAt)}` : ''}</span><strong>{entry.title}</strong><small>{customer?.displayName || 'Internal / no customer'}{assigned ? ` · ${assigned.displayName || assigned.email}` : ''}</small></button><select value={entry.status} disabled={busyId === entry.id} onChange={(event) => void updateEntryStatus(entry, event.target.value)} aria-label={`Status for ${entry.title}`}>{SCHEDULE_STATUSES.filter((item) => item.value).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></article>;
              })}
              {!loading && selectedEntries.length === 0 && <div className="schedule-empty"><strong>No work scheduled</strong><p>Add a service, site visit, or internal item for this day.</p><button className="secondary-button compact-button" type="button" onClick={() => openCreateEntry(selectedDate)}>Add schedule item</button></div>}
              {loading && <div className="schedule-empty"><p>Loading schedule…</p></div>}
            </div>
          </aside>
        </div>
      )}

      {tab === 'availability' && (
        <div className="data-section scheduling-data-section">
          <div className="section-heading-row"><div><h2>Customer booking windows</h2><p className="section-subtitle">Open windows are exposed through the customer portal. Capacity automatically accounts for requested and confirmed bookings.</p></div><span className="record-count">{slots.length} this view</span></div>
          <div className="table-wrap"><table className="feature-table"><thead><tr><th>Date & time</th><th>Services</th><th>Capacity</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {slots.map((slot) => <tr key={slot.id}><td><strong className="table-primary">{formatDateTime(slot.startsAt)}</strong><span className="table-secondary">Ends {formatDateTime(slot.endsAt)}</span></td><td><span className="table-secondary">{slot.serviceTypes?.length ? slot.serviceTypes.map(serviceLabel).join(', ') : 'Any supported service'}</span></td><td><strong className="table-primary">{slot.bookedCount || 0} / {slot.capacity}</strong><span className="table-secondary">{slot.available ? 'Space available' : 'Unavailable / full'}</span></td><td><span className={`status-pill ${slot.status}`}>{slot.status}</span></td><td><div className="row-button-group"><button className="secondary-button compact-button" type="button" onClick={() => openEditSlot(slot)}>Edit</button><button className="secondary-button compact-button" type="button" disabled={busyId === slot.id} onClick={() => void toggleSlotStatus(slot)}>{slot.status === 'open' ? 'Close' : 'Reopen'}</button></div></td></tr>)}
            {!loading && slots.length === 0 && <tr><td colSpan="5" className="empty-cell">No customer availability is published for this month.</td></tr>}
            {loading && <tr><td colSpan="5" className="empty-cell">Loading availability…</td></tr>}
          </tbody></table></div>
        </div>
      )}

      {tab === 'bookings' && (
        <div className="data-section scheduling-data-section">
          <div className="section-heading-row"><div><h2>Customer booking requests</h2><p className="section-subtitle">Confirm a request to move it into the operating schedule. Declined and cancelled requests remain visible for history.</p></div><span className="record-count">{bookings.length} this view</span></div>
          <div className="table-wrap"><table className="feature-table bookings-table"><thead><tr><th>Customer</th><th>Service</th><th>Requested time</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {bookings.map((booking) => <tr key={booking.id}><td><strong className="table-primary">{booking.customerName || customerMap.get(booking.customerId)?.displayName || 'Customer'}</strong><span className="table-secondary">{booking.propertyLabel || 'Primary / selected property'}</span>{booking.notes && <span className="table-secondary booking-notes">{booking.notes}</span>}</td><td><strong className="table-primary">{serviceLabel(booking.serviceType)}</strong>{booking.scheduleEntryId && <span className="table-secondary">Linked to schedule</span>}</td><td><strong className="table-primary">{formatDateTime(booking.startsAt)}</strong><span className="table-secondary">Ends {formatDateTime(booking.endsAt)}</span></td><td><span className={`status-pill ${booking.status}`}>{booking.status}</span></td><td><div className="row-button-group">{booking.status === 'requested' && <><button className="primary-button compact-button" type="button" disabled={busyId === booking.id} onClick={() => void updateBooking(booking, 'confirmed')}>Confirm</button><button className="secondary-button compact-button" type="button" disabled={busyId === booking.id} onClick={() => void updateBooking(booking, 'declined')}>Decline</button></>}{booking.status === 'confirmed' && <><button className="secondary-button compact-button" type="button" disabled={busyId === booking.id} onClick={() => void updateBooking(booking, 'completed')}>Complete</button><button className="secondary-button compact-button" type="button" disabled={busyId === booking.id} onClick={() => void updateBooking(booking, 'cancelled')}>Cancel</button></>}{['declined', 'cancelled', 'completed'].includes(booking.status) && <span className="table-secondary">No action required</span>}</div></td></tr>)}
            {!loading && bookings.length === 0 && <tr><td colSpan="5" className="empty-cell">No booking requests match this month and status filter.</td></tr>}
            {loading && <tr><td colSpan="5" className="empty-cell">Loading booking requests…</td></tr>}
          </tbody></table></div>
        </div>
      )}
    </section>
  );
}
