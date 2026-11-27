import React, { useEffect, useMemo, useState } from 'react';
import { X, Phone, Users, MapPin, Clock, User, Car } from 'lucide-react';
import { useAppLanguage } from '../utils/i18n';

export interface DriverScheduleCalendarProps {
  vehicles: any[];
  trips: any[];
  /** Selected local date, `YYYY-MM-DD`. */
  dateStr: string;
  currentUserId?: number | null;
  /** Show booker / driver phone numbers in the details sheet (FM / HWS / ADM). */
  showContacts?: boolean;
  /** When provided, free hour cells become tappable "+ Book" slots. */
  onBookSlot?: (vehicleId: number, hour: number) => void;
  /** When provided, other people's bookings show a Negotiate / Hitchhike action. */
  onNegotiate?: (trip: any) => void;
  /** Optional admin action (e.g. open dispatch modal). */
  onOpenTrip?: (trip: any) => void;
  openTripLabel?: string;
}

export const SCHEDULE_START_HOUR = 7;
export const SCHEDULE_END_HOUR = 17; // exclusive — last row is 16:00–17:00
const HOUR_PX = 64;
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

/** Dedupe, keep only active bookings that touch the selected day, and clip them to the visible window. */
export function getDayScheduleEvents(trips: any[], dateStr: string) {
  const seen = new Set<number>();
  const [y, m, d] = dateStr.split('-').map(Number);
  const dayStart = new Date(y, (m || 1) - 1, d || 1, SCHEDULE_START_HOUR, 0, 0, 0).getTime();
  const dayEnd = new Date(y, (m || 1) - 1, d || 1, SCHEDULE_END_HOUR, 0, 0, 0).getTime();
  const out: Array<{ trip: any; start: Date; end: Date; startH: number; endH: number }> = [];
  for (const trip of trips) {
    const id = Number(trip.id);
    if (seen.has(id)) continue;
    const status = String(trip.status || '').toUpperCase();
    if (['COMPLETED', 'CANCELLED', 'REJECTED'].includes(status)) continue;
    if (['CANCELLED', 'COMPLETED'].includes(String(trip.booking_status || '').toUpperCase())) continue;
    const start = new Date(trip.start_time);
    const end = new Date(trip.end_time || trip.start_time);
    if (Number.isNaN(start.getTime())) continue;
    const endMs = Math.max(end.getTime(), start.getTime() + 30 * 60000);
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
  onBookSlot,
  onNegotiate,
  onOpenTrip,
  openTripLabel,
}) => {
  const { t } = useAppLanguage();
  const [selected, setSelected] = useState<any | null>(null);
  const [now, setNow] = useState(() => new Date());

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
      const aBusy = a.placed.length > 0 ? 1 : 0;
      const bBusy = b.placed.length > 0 ? 1 : 0;
      if (aBusy !== bBusy) return bBusy - aBusy;
      return a.idx - b.idx;
    });

  const isHourFree = (placed: Array<{ startH: number; endH: number }>, h: number) =>
    !placed.some((e) => e.startH < h + 1 && e.endH > h);

  return (
    <div className="gf-gcal" id="driver-schedule-calendar">
      <div className="gf-gcal-scroll">
        <div className="gf-gcal-grid" style={{ minWidth: `${GUTTER_PX + columns.length * COLUMN_MIN_PX}px` }}>
          {/* Column headers: car + driver */}
          <div className="gf-gcal-head" style={{ gridTemplateColumns: `${GUTTER_PX}px repeat(${columns.length}, minmax(${COLUMN_MIN_PX}px, 1fr))` }}>
            <div className="gf-gcal-head-gutter" />
            {columns.map(({ v, placed }) => (
              <div key={v.id} className="gf-gcal-head-cell">
                <div className="gf-gcal-plate mono">{v.registration_plate}</div>
                <div className="gf-gcal-car">{v.make} {v.model}</div>
                <div className="gf-gcal-driver">
                  <User size={11} /> <span className="notranslate" translate="no">{v.default_driver_name || t('Pool Driver')}</span>
                </div>
                <div className={`gf-gcal-count ${placed.length ? 'is-busy' : ''}`}>
                  {v.status && v.status !== 'Available'
                    ? t(v.status)
                    : placed.length
                    ? `${placed.length} ${t('booked')}`
                    : t('Available All Day')}
                </div>
              </div>
            ))}
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

                  {placed.map(({ trip, start, end, startH, endH, lane }) => {
                    const top = (startH - SCHEDULE_START_HOUR) * HOUR_PX;
                    const height = Math.max(26, (endH - startH) * HOUR_PX - 2);
                    const widthPct = 100 / laneCount;
                    const color = colorFor(trip);
                    const isPending = String(trip.status).toUpperCase() === 'PENDING_APPROVAL';
                    const isMine = currentUserId != null && Number(trip.requester_id) === Number(currentUserId);
                    const pax = parsePassengers(trip);
                    const darkText = color === '#f6bf26';
                    return (
                      <button
                        type="button"
                        key={trip.id}
                        className={`gf-gcal-event pressable ${isPending ? 'is-pending' : ''}`}
                        data-trip-id={trip.id}
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          left: `calc(${lane * widthPct}% + 2px)`,
                          width: `calc(${widthPct}% - 4px)`,
                          background: isPending ? `${color}26` : color,
                          borderColor: color,
                          color: isPending ? 'var(--color-text-primary)' : darkText ? '#1f1f1f' : '#ffffff',
                        }}
                        onClick={() => setSelected({ trip })}
                        title={`${trip.requester_name || ''} • ${fmtTime(start)} – ${fmtTime(end)} • ${trip.destination || ''}`}
                      >
                        <span className="gf-gcal-event-name notranslate" translate="no">
                          {trip.requester_name || t('Employee')}
                          {isMine ? ` (${t('You')})` : ''}
                        </span>
                        <span className="gf-gcal-event-time mono">
                          {fmtTime(start)} – {fmtTime(end)}
                        </span>
                        {height >= 56 && trip.destination && (
                          <span className="gf-gcal-event-sub">→ {trip.destination}</span>
                        )}
                        {height >= 76 && (
                          <span className="gf-gcal-event-sub">
                            {pax.length || trip.passenger_count || 1} {t('pax')}
                            {isPending ? ` • ${t('Pending')}` : ''}
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
              const { trip, start, end } = selectedLive;
              const pax = parsePassengers(trip);
              const isMine = currentUserId != null && Number(trip.requester_id) === Number(currentUserId);
              const status = String(trip.status || '').toUpperCase();
              return (
                <>
                  <div className="gf-gcal-sheet-head">
                    <span className="gf-gcal-sheet-swatch" style={{ background: colorFor(trip) }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="gf-gcal-sheet-title notranslate" translate="no">
                        {trip.requester_name || t('Employee')}
                      </div>
                      <div className="gf-gcal-sheet-sub">
                        {trip.department_name || ''} • {t(status === 'PENDING_APPROVAL' ? 'Pending' : status === 'IN_PROGRESS' ? 'In Progress' : 'Approved')}
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
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                    {onNegotiate && !isMine && (
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
                        {openTripLabel || t('View Details')}
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverScheduleCalendar;
