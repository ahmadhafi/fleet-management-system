import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Phone, Users, MapPin, Clock, User, Car, Camera, Gauge } from 'lucide-react';
import { useAppLanguage } from '../utils/i18n';

export interface DriverScheduleCalendarProps {
  vehicles: any[];
  trips: any[];
  /** Selected local date, `YYYY-MM-DD`. */
  dateStr: string;
  currentUserId?: number | null;
  /** Show booker / driver phone numbers in the details sheet (FM / HWS / ADM). */
  showContacts?: boolean;
  /** Show start/end odometer readings & tappable photos in the details sheet (ADM / FM / HWS / DRV). */
  showOdometerPhotos?: boolean;
  /** When provided, free hour cells become tappable "+ Book" slots. */
  onBookSlot?: (vehicleId: number, hour: number) => void;
  /** When provided, other people's active bookings show a Negotiate / Hitchhike action. */
  onNegotiate?: (trip: any) => void;
  /** Optional admin action (e.g. open dispatch or audit modal). */
  onOpenTrip?: (trip: any) => void;
  openTripLabel?: string;
}

export const SCHEDULE_START_HOUR = 0;
export const SCHEDULE_END_HOUR = 24; // exclusive — full 24-hour schedule: 00:00 to 23:00 (00:00–24:00)
const HOUR_PX = 56;
const GUTTER_PX = 56;
const COLUMN_MIN_PX = 148;

// Google Calendar–like event palette (no greens, per brand rules)
const EVENT_COLORS = ['#1a73e8', '#8e24aa', '#f4511e', '#e67c73', '#3f51b5', '#d50000', '#039be5', '#ef6c00', '#7986cb', '#f6bf26'];

const pad2 = (n: number) => String(n).padStart(2, '0');
const localDateKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fmtTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

export function todayLocalDateStr(): string {
  return localDateKey(new Date());
}

export function isHistoryTripRecord(trip: any): boolean {
  const status = String(trip?.status || '').toUpperCase();
  const bookingStatus = String(trip?.booking_status || '').toUpperCase();
  return ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(status) || ['COMPLETED', 'CANCELLED'].includes(bookingStatus);
}

export function isTransferredTripRecord(trip: any): boolean {
  if (trip?.transferred_to_trip_id) return true;
  const status = String(trip?.status || '').toUpperCase();
  const reason = String(trip?.cancellation_reason || '');
  return status === 'CANCELLED' && /transfer|negotiat/i.test(reason);
}

function colorFor(trip: any): string {
  const key = Number(trip.requester_id) || String(trip.requester_name || trip.id).length;
  return EVENT_COLORS[Math.abs(key) % EVENT_COLORS.length];
}

function parsePassengers(trip: any): string[] {
  const raw: string[] = [];
  if (trip.passengers_json) {
    try {
      const parsed = JSON.parse(trip.passengers_json);
      if (Array.isArray(parsed) && parsed.length > 0) {
        for (const p of parsed) {
          const text = String(p?.nickname || p?.name || p || '').trim();
          for (const part of text.split(/[,\n]+/)) {
            const clean = part.replace(/^\d+\.\s*/, '').trim();
            if (clean) raw.push(clean);
          }
        }
      }
    } catch {
      /* ignore malformed JSON */
    }
  }
  if (raw.length === 0 && trip.passenger_nickname) {
    for (const part of String(trip.passenger_nickname).split(/[,\n]+/)) {
      const clean = part.replace(/^\d+\.\s*/, '').trim();
      if (clean) raw.push(clean);
    }
  }
  return raw;
}

/** Dedupe, keep all bookings (active + completed/cancelled/rejected/transferred audit history) that touch the selected day, and clip them to the visible window. */
export function getDayScheduleEvents(trips: any[], dateStr: string, options?: { includeHistory?: boolean }) {
  const includeHistory = options?.includeHistory !== false;
  const seen = new Set<number>();
  const [y, m, d] = dateStr.split('-').map(Number);
  const dayStart = new Date(y, (m || 1) - 1, d || 1, SCHEDULE_START_HOUR, 0, 0, 0).getTime();
  const dayEnd = new Date(y, (m || 1) - 1, d || 1, SCHEDULE_END_HOUR, 0, 0, 0).getTime();
  const out: Array<{ trip: any; start: Date; end: Date; startH: number; endH: number; isHistory: boolean; isTransferred: boolean }> = [];
  for (const trip of trips) {
    const id = Number(trip.id);
    if (seen.has(id)) continue;
    const isHistory = isHistoryTripRecord(trip);
    if (!includeHistory && isHistory) continue;
    const isTransferred = isTransferredTripRecord(trip);
    const start = new Date(trip.start_time);
    const end = new Date(trip.end_time || trip.start_time);
    if (Number.isNaN(start.getTime())) continue;
    const endMs = Math.max(end.getTime(), start.getTime() + 15 * 60000);
    if (endMs <= dayStart || start.getTime() >= dayEnd) continue;
    seen.add(id);
    const clipStart = Math.max(start.getTime(), dayStart);
    const clipEnd = Math.min(endMs, dayEnd);
    out.push({
      trip,
      start,
      end: new Date(endMs),
      startH: SCHEDULE_START_HOUR + (clipStart - dayStart) / 3600000,
      endH: SCHEDULE_START_HOUR + (clipEnd - dayStart) / 3600000,
      isHistory,
      isTransferred,
    });
  }
  return out;
}

export const DriverScheduleCalendar: React.FC<DriverScheduleCalendarProps> = ({
  vehicles,
  trips,
  dateStr,
  currentUserId,
  showContacts = false,
  showOdometerPhotos = false,
  onBookSlot,
  onNegotiate,
  onOpenTrip,
  openTripLabel,
}) => {
  const { t } = useAppLanguage();
  const [selected, setSelected] = useState<any | null>(null);
  const [enlargedPhoto, setEnlargedPhoto] = useState<{ src: string; title: string; subtitle?: string } | null>(null);
  const [now, setNow] = useState(() => new Date());
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const events = useMemo(() => getDayScheduleEvents(trips, dateStr), [trips, dateStr]);
  const hours = useMemo(() => {
    const list: number[] = [];
    for (let h = SCHEDULE_START_HOUR; h < SCHEDULE_END_HOUR; h++) list.push(h);
    return list;
  }, []);
  const bodyHeight = hours.length * HOUR_PX;
  const isToday = dateStr === localDateKey(now);
  const nowH = now.getHours() + now.getMinutes() / 60;
  const showNowLine = isToday && nowH >= SCHEDULE_START_HOUR && nowH <= SCHEDULE_END_HOUR;

  // Smart initial vertical scroll so 24-hour grid opens near active hours while keeping 00:00–23:00 scrollable
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const earliestEventH = events.length > 0 ? Math.min(...events.map((e) => e.startH)) : null;
    const targetHour = isToday
      ? Math.max(0, Math.floor(nowH) - 1)
      : earliestEventH !== null
      ? Math.max(0, Math.floor(earliestEventH) - 1)
      : 7;
    el.scrollTop = Math.min(targetHour, 18) * HOUR_PX;
  }, [dateStr]);

  // Keep the details sheet in sync with live trip updates
  const selectedLive = selected ? events.find((e) => Number(e.trip.id) === Number(selected.trip.id)) || null : null;

  const columns = vehicles
    .map((v, idx) => {
      const vEvents = events
        .filter((e) => Number(e.trip.vehicle_id) === Number(v.id))
        .sort((a, b) => a.startH - b.startH);
      // Lane assignment for overlapping bookings (side-by-side like Google Calendar)
      const laneEnds: number[] = [];
      const placed = vEvents.map((e) => {
        let lane = laneEnds.findIndex((endH) => endH <= e.startH + 1e-6);
        if (lane === -1) {
          lane = laneEnds.length;
          laneEnds.push(e.endH);
        } else {
          laneEnds[lane] = e.endH;
        }
        return { ...e, lane };
      });
      const laneCount = Math.max(1, laneEnds.length);
      return { v, placed, laneCount, idx };
    })
    .sort((a, b) => {
      const aActive = a.placed.some((e) => !e.isHistory) ? 2 : a.placed.length > 0 ? 1 : 0;
      const bActive = b.placed.some((e) => !e.isHistory) ? 2 : b.placed.length > 0 ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return a.idx - b.idx;
    });

  // Only active bookings block an hour cell from being booked; completed/cancelled/transferred audit records never block new bookings
  const isHourFree = (placed: Array<{ startH: number; endH: number; isHistory: boolean }>, h: number) =>
    !placed.some((e) => !e.isHistory && e.startH < h + 1 && e.endH > h);

  const getStatusLabel = (trip: any, isTransferred: boolean) => {
    const st = String(trip.status || '').toUpperCase();
    if (isTransferred) return t('Transferred');
    if (st === 'COMPLETED') return t('Completed');
    if (st === 'CANCELLED') return t('Cancelled');
    if (st === 'REJECTED') return t('Rejected');
    if (st === 'PENDING_APPROVAL') return t('Pending');
    if (st === 'IN_PROGRESS') return t('In Progress');
    return t('Approved');
  };

  return (
    <div className="gf-gcal" id="driver-schedule-calendar">
      <div className="gf-gcal-scroll" ref={scrollRef}>
        <div className="gf-gcal-grid" style={{ minWidth: `${GUTTER_PX + columns.length * COLUMN_MIN_PX}px` }}>
          {/* Column headers: car + driver */}
          <div className="gf-gcal-head" style={{ gridTemplateColumns: `${GUTTER_PX}px repeat(${columns.length}, minmax(${COLUMN_MIN_PX}px, 1fr))` }}>
            <div className="gf-gcal-head-gutter" />
            {columns.map(({ v, placed }) => {
              const activePlaced = placed.filter((ev) => !ev.isHistory);
              const historyCount = placed.length - activePlaced.length;
              const isInUseNow =
                isToday &&
                activePlaced.some(
                  (ev) =>
                    String(ev.trip?.status || '').toUpperCase() === 'IN_PROGRESS' ||
                    (ev.startH <= nowH && ev.endH > nowH)
                );
              return (
                <div key={v.id} className="gf-gcal-head-cell">
                  <div className="gf-gcal-plate mono">{v.registration_plate}</div>
                  <div className="gf-gcal-car">{v.make} {v.model}</div>
                  <div className="gf-gcal-driver">
                    <User size={11} /> <span className="notranslate" translate="no">{v.default_driver_name || t('Pool Driver')}</span>
                  </div>
                  <div className={`gf-gcal-count ${activePlaced.length ? 'is-busy' : ''}`}>
                    {v.status && v.status !== 'Available'
                      ? t(v.status)
                      : isInUseNow
                      ? t('In Use Now')
                      : activePlaced.length
                      ? `${activePlaced.length} ${t('booked')}${historyCount > 0 ? ` · ${historyCount} ${t('history')}` : ''}`
                      : historyCount > 0
                      ? `${t('Available')} · ${historyCount} ${t('history')}`
                      : t('Available All Day')}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Body */}
          <div className="gf-gcal-body" style={{ gridTemplateColumns: `${GUTTER_PX}px repeat(${columns.length}, minmax(${COLUMN_MIN_PX}px, 1fr))`, height: `${bodyHeight}px` }}>
            <div className="gf-gcal-gutter">
              {hours.map((h) => (
                <div key={h} className="gf-gcal-hour-label mono" style={{ top: `${(h - SCHEDULE_START_HOUR) * HOUR_PX}px` }}>
                  {pad2(h)}:00
                </div>
              ))}
            </div>

            {columns.map(({ v, placed, laneCount }) => {
              const canBookVehicle = Boolean(onBookSlot) && (!v.status || v.status === 'Available');
              return (
                <div key={v.id} className="gf-gcal-col">
                  {hours.map((h) => {
                    const free = isHourFree(placed, h);
                    const isPast = isToday && h + 1 <= nowH;
                    return (
                      <div key={h} className="gf-gcal-cell" style={{ top: `${(h - SCHEDULE_START_HOUR) * HOUR_PX}px`, height: `${HOUR_PX}px` }}>
                        {free && canBookVehicle && !isPast && (
                          <button
                            type="button"
                            className="gf-gcal-book pressable"
                            onClick={() => onBookSlot!(Number(v.id), h)}
                            aria-label={`${t('Book')} ${pad2(h)}:00 ${v.registration_plate}`}
                          >
                            + {pad2(h)}:00
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {placed.map(({ trip, start, end, startH, endH, lane, isHistory, isTransferred }) => {
                    const top = (startH - SCHEDULE_START_HOUR) * HOUR_PX;
                    const height = Math.max(26, (endH - startH) * HOUR_PX - 2);
                    const widthPct = 100 / laneCount;
                    const color = colorFor(trip);
                    const st = String(trip.status || '').toUpperCase();
                    const isPending = st === 'PENDING_APPROVAL';
                    const isCompleted = st === 'COMPLETED';
                    const isMine = currentUserId != null && Number(trip.requester_id) === Number(currentUserId);
                    const pax = parsePassengers(trip);
                    const darkText = color === '#f6bf26';

                    let blockBg = isPending ? `${color}26` : color;
                    let blockBorder = color;
                    let blockColor = isPending ? 'var(--color-text-primary)' : darkText ? '#1f1f1f' : '#ffffff';
                    let borderStyle: React.CSSProperties['borderStyle'] = isPending ? 'dashed' : 'solid';
                    let leftAccent: string | undefined;

                    if (isHistory) {
                      blockColor = 'var(--color-text-primary)';
                      if (isCompleted) {
                        blockBg = 'var(--color-bg-subtle)';
                        blockBorder = 'rgba(100, 116, 139, 0.55)';
                        borderStyle = 'solid';
                        leftAccent = '4px solid #0284c7';
                      } else if (isTransferred) {
                        blockBg = 'rgba(124, 58, 237, 0.12)';
                        blockBorder = 'rgba(124, 58, 237, 0.55)';
                        borderStyle = 'dashed';
                        leftAccent = '4px solid #7c3aed';
                      } else {
                        blockBg = 'rgba(148, 163, 184, 0.16)';
                        blockBorder = 'rgba(148, 163, 184, 0.55)';
                        borderStyle = 'dashed';
                        leftAccent = st === 'REJECTED' ? '4px solid #dc2626' : '4px solid #64748b';
                      }
                    }

                    const statusBadgeText = getStatusLabel(trip, isTransferred);
                    const hasOdoPhotos = Boolean(trip.start_odometer_photo_url || trip.end_odometer_photo_url);

                    return (
                      <button
                        type="button"
                        key={trip.id}
                        className={`gf-gcal-event pressable ${isPending ? 'is-pending' : ''} ${isHistory ? 'is-history' : ''}`}
                        data-trip-id={trip.id}
                        data-trip-status={isTransferred ? 'TRANSFERRED' : st}
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          left: `calc(${lane * widthPct}% + 2px)`,
                          width: `calc(${widthPct}% - 4px)`,
                          background: blockBg,
                          borderColor: blockBorder,
                          borderStyle,
                          borderLeft: leftAccent,
                          color: blockColor,
                          opacity: isHistory ? 0.92 : 1,
                        }}
                        onClick={() => setSelected({ trip })}
                        title={`${trip.requester_name || ''} • ${fmtTime(start)} – ${fmtTime(end)} • ${statusBadgeText} • ${trip.destination || ''}`}
                      >
                        <span className="gf-gcal-event-name notranslate" translate="no">
                          {trip.requester_name || t('Employee')}
                          {isMine ? ` (${t('You')})` : ''}
                        </span>
                        <span className="gf-gcal-event-time mono">
                          {fmtTime(start)} – {fmtTime(end)}
                          {isHistory ? ` • ${statusBadgeText}` : ''}
                        </span>
                        {height >= 56 && trip.destination && (
                          <span className="gf-gcal-event-sub">→ {trip.destination}</span>
                        )}
                        {height >= 76 && (
                          <span className="gf-gcal-event-sub">
                            {pax.length || trip.passenger_count || 1} {t('pax')}
                            {isPending ? ` • ${t('Pending')}` : ''}
                            {isCompleted && trip.distance_km != null ? ` • ${trip.distance_km} km` : ''}
                            {showOdometerPhotos && hasOdoPhotos ? ` • ${t('Odo Photo')}` : ''}
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {showNowLine && (
                    <div className="gf-gcal-now" style={{ top: `${(nowH - SCHEDULE_START_HOUR) * HOUR_PX}px` }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedLive && (
        <div className="gf-gcal-sheet-backdrop" onClick={() => setSelected(null)} role="presentation">
          <div
            className="gf-gcal-sheet"
            id="schedule-booking-details"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const { trip, start, end, isHistory, isTransferred } = selectedLive;
              const pax = parsePassengers(trip);
              const isMine = currentUserId != null && Number(trip.requester_id) === Number(currentUserId);
              const status = String(trip.status || '').toUpperCase();
              const statusLabel = getStatusLabel(trip, isTransferred);
              const showOdoBlock =
                showOdometerPhotos &&
                (trip.start_odometer != null ||
                  trip.end_odometer != null ||
                  trip.distance_km != null ||
                  Boolean(trip.start_odometer_photo_url) ||
                  Boolean(trip.end_odometer_photo_url) ||
                  status === 'COMPLETED' ||
                  status === 'IN_PROGRESS');

              return (
                <>
                  <div className="gf-gcal-sheet-head">
                    <span
                      className="gf-gcal-sheet-swatch"
                      style={{
                        background: isHistory
                          ? status === 'COMPLETED'
                            ? '#0284c7'
                            : isTransferred
                            ? '#7c3aed'
                            : '#64748b'
                          : colorFor(trip),
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="gf-gcal-sheet-title notranslate" translate="no">
                        {trip.requester_name || t('Employee')}
                      </div>
                      <div className="gf-gcal-sheet-sub">
                        {trip.department_name || ''} • {statusLabel}
                        {trip.transferred_to_trip_id ? ` → #${trip.transferred_to_trip_id}` : ''}
                        {trip.transferred_from_trip_id ? ` (${t('Transferred from')} #${trip.transferred_from_trip_id})` : ''}
                      </div>
                    </div>
                    <button type="button" className="gf-icon-btn-48 pressable" onClick={() => setSelected(null)} aria-label={t('Close')} style={{ width: 34, height: 34 }}>
                      <X size={18} />
                    </button>
                  </div>
                  <div className="gf-gcal-sheet-row">
                    <Clock size={15} />
                    <span className="mono">{fmtTime(start)} – {fmtTime(end)}</span>
                  </div>
                  {trip.actual_start_time && (
                    <div className="gf-gcal-sheet-row">
                      <Clock size={15} />
                      <span>
                        <strong>{t('Actual Trip Time')}:</strong>{' '}
                        <span className="mono">
                          {new Date(trip.actual_start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' → '}
                          {trip.actual_end_time ? new Date(trip.actual_end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </span>
                      </span>
                    </div>
                  )}
                  <div className="gf-gcal-sheet-row">
                    <Car size={15} />
                    <span>
                      <strong className="mono">{trip.registration_plate}</strong> {trip.make} {trip.model} • {t('Driver')}:{' '}
                      <strong className="notranslate" translate="no">{trip.assigned_driver_name || t('Pool Driver')}</strong>
                      {showContacts && trip.assigned_driver_phone ? ` (${trip.assigned_driver_phone})` : ''}
                    </span>
                  </div>
                  <div className="gf-gcal-sheet-row">
                    <MapPin size={15} />
                    <span>{trip.origin || '-'} → {trip.destination || '-'}</span>
                  </div>
                  <div className="gf-gcal-sheet-row" style={{ alignItems: 'flex-start' }}>
                    <Users size={15} />
                    <div>
                      <div style={{ fontWeight: 700 }}>{t('Passengers On Board')} ({pax.length || trip.passenger_count || 1})</div>
                      {pax.length > 0 ? (
                        <ol className="gf-gcal-pax notranslate" translate="no">
                          {pax.map((p, i) => (
                            <li key={`${p}-${i}`}>{p}</li>
                          ))}
                        </ol>
                      ) : (
                        <div className="gf-gcal-sheet-sub notranslate" translate="no">{trip.requester_name}</div>
                      )}
                    </div>
                  </div>
                  {showContacts && trip.requester_contact && (
                    <div className="gf-gcal-sheet-row">
                      <Phone size={15} />
                      <a href={`tel:${trip.requester_contact}`}>{trip.requester_contact}</a>
                    </div>
                  )}
                  {trip.purpose && <div className="gf-gcal-sheet-purpose">“{trip.purpose}”</div>}
                  {trip.cancellation_reason && (
                    <div className="gf-gcal-sheet-row" style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      <span><strong>{t('Note')}:</strong> {trip.cancellation_reason}</span>
                    </div>
                  )}

                  {showOdoBlock && (
                    <div
                      id="calendar-odometer-photos"
                      style={{
                        marginTop: '6px',
                        padding: '10px',
                        borderRadius: '10px',
                        background: 'var(--color-bg-subtle)',
                        border: '1px solid var(--color-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                          <Gauge size={14} style={{ color: 'var(--color-samsung-blue)' }} />
                          {t('Odometer & Distance')}
                        </span>
                        <span className="mono" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-samsung-blue-text)' }}>
                          {trip.start_odometer ?? '-'} → {trip.end_odometer ?? '-'} km
                          {trip.distance_km != null ? ` (${trip.distance_km} km)` : ''}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        {trip.start_odometer_photo_url ? (
                          <button
                            type="button"
                            className="pressable"
                            data-testid="calendar-start-odo-photo"
                            onClick={() =>
                              setEnlargedPhoto({
                                src: trip.start_odometer_photo_url,
                                title: `${t('Start Odometer Photo')} — #${trip.id}`,
                                subtitle: `${trip.registration_plate || ''} • ${trip.start_odometer ?? '-'} km`,
                              })
                            }
                            style={{
                              padding: 0,
                              border: '1px solid var(--color-border)',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              background: 'var(--color-bg-surface)',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <img
                              src={trip.start_odometer_photo_url}
                              alt={t('Start Odometer Photo')}
                              style={{ width: '100%', height: '84px', objectFit: 'cover', display: 'block' }}
                            />
                            <div style={{ padding: '4px 6px', fontSize: '10.5px', fontWeight: 700, color: 'var(--color-text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{t('Start Odo')}</span>
                              <span style={{ color: 'var(--color-samsung-blue-text)', fontSize: '10px' }}>{t('Tap to enlarge')}</span>
                            </div>
                          </button>
                        ) : (
                          <div style={{ padding: '12px 8px', borderRadius: '8px', border: '1px dashed var(--color-border)', textAlign: 'center', fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            <Camera size={14} />
                            <span>{t('No start photo')}</span>
                          </div>
                        )}

                        {trip.end_odometer_photo_url ? (
                          <button
                            type="button"
                            className="pressable"
                            data-testid="calendar-end-odo-photo"
                            onClick={() =>
                              setEnlargedPhoto({
                                src: trip.end_odometer_photo_url,
                                title: `${t('End Odometer Photo')} — #${trip.id}`,
                                subtitle: `${trip.registration_plate || ''} • ${trip.end_odometer ?? '-'} km${trip.distance_km != null ? ` (${trip.distance_km} km)` : ''}`,
                              })
                            }
                            style={{
                              padding: 0,
                              border: '1px solid var(--color-border)',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              background: 'var(--color-bg-surface)',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <img
                              src={trip.end_odometer_photo_url}
                              alt={t('End Odometer Photo')}
                              style={{ width: '100%', height: '84px', objectFit: 'cover', display: 'block' }}
                            />
                            <div style={{ padding: '4px 6px', fontSize: '10.5px', fontWeight: 700, color: 'var(--color-text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{t('End Odo')}</span>
                              <span style={{ color: 'var(--color-samsung-blue-text)', fontSize: '10px' }}>{t('Tap to enlarge')}</span>
                            </div>
                          </button>
                        ) : (
                          <div style={{ padding: '12px 8px', borderRadius: '8px', border: '1px dashed var(--color-border)', textAlign: 'center', fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            <Camera size={14} />
                            <span>{t('No end photo')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                    {onNegotiate && !isMine && !isHistory && (
                      <button
                        type="button"
                        className="gf-btn gf-btn-primary gf-btn-sm pressable"
                        onClick={() => {
                          setSelected(null);
                          onNegotiate(trip);
                        }}
                      >
                        {t('Negotiate / Hitchhike')}
                      </button>
                    )}
                    {onOpenTrip && (
                      <button
                        type="button"
                        className="gf-btn gf-btn-secondary gf-btn-sm pressable"
                        onClick={() => {
                          setSelected(null);
                          onOpenTrip(trip);
                        }}
                      >
                        {isHistory ? t('View Audit Details') : openTripLabel || t('View Details')}
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {enlargedPhoto && (
        <div
          id="odometer-photo-lightbox"
          className="gf-gcal-sheet-backdrop"
          style={{ zIndex: 9999, padding: '16px', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setEnlargedPhoto(null)}
          role="dialog"
          aria-modal="true"
          aria-label={enlargedPhoto.title}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '640px',
              background: 'var(--color-bg-surface)',
              borderRadius: '14px',
              border: '1px solid var(--color-border)',
              overflow: 'hidden',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.45)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--color-divider)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--color-text-primary)' }}>{enlargedPhoto.title}</div>
                {enlargedPhoto.subtitle && <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)' }}>{enlargedPhoto.subtitle}</div>}
              </div>
              <button type="button" className="gf-icon-btn-48 pressable" style={{ width: 32, height: 32 }} onClick={() => setEnlargedPhoto(null)} aria-label={t('Close')}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '10px', background: '#0b1120', display: 'flex', justifyContent: 'center', alignItems: 'center', maxHeight: '72vh', overflow: 'auto' }}>
              <img src={enlargedPhoto.src} alt={enlargedPhoto.title} style={{ maxWidth: '100%', maxHeight: '68vh', objectFit: 'contain', borderRadius: '6px' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverScheduleCalendar;

