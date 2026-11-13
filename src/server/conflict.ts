import type { AppDatabase } from './db.ts';

export interface ConflictCheckResult {
  hasConflict: boolean;
  reason?: string;
  conflictingBookingId?: number;
  conflictingAssignmentId?: number;
}

/**
 * Checks whether a vehicle is available for [startTimeIso, endTimeIso].
 * Implements:
 * - VEH-04 / BKG-08 / Revision #3: Rejects if vehicle status is Standby, In Maintenance, Deactivated, or Retired.
 * - MNT-03: Rejects if vehicle has overlapping planned maintenance where blocks_availability = 1.
 * - BKG-02 / BKG-03 / Revision #4: Rejects if vehicle has an overlapping booking (including PENDING_APPROVAL, ACTIVE, IN_PROGRESS)
 *   with turnaround buffer applied.
 */
export function checkVehicleConflict(
  db: AppDatabase,
  vehicleId: number,
  startTimeIso: string,
  endTimeIso: string,
  excludeBookingId?: number,
  excludeTripRequestId?: number,
  customBufferMinutes?: number
): ConflictCheckResult {
  const vehicle = db.prepare('SELECT id, registration_plate, status, standby_reason FROM vehicles WHERE id = ?').get(vehicleId) as
    | { id: number; registration_plate: string; status: string; standby_reason: string | null }
    | undefined;

  if (!vehicle) {
    return { hasConflict: true, reason: 'Vehicle not found' };
  }

  if (vehicle.status !== 'Available') {
    const extra = vehicle.standby_reason ? ` (${vehicle.standby_reason})` : '';
    return {
      hasConflict: true,
      reason: `Vehicle ${vehicle.registration_plate} is currently unavailable with status: ${vehicle.status}${extra} (BKG-08)`,
    };
  }

  const startMs = new Date(startTimeIso).getTime();
  const endMs = new Date(endTimeIso).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return { hasConflict: true, reason: 'Invalid time window: end time must be after start time (REQ-02)' };
  }

  // Check planned maintenance windows (MNT-03)
  const maintRows = db
    .prepare(
      `SELECT id, maintenance_type, service_date, end_date
       FROM maintenance_records
       WHERE vehicle_id = ? AND blocks_availability = 1 AND status != 'Completed'`
    )
    .all(vehicleId) as Array<{ id: number; maintenance_type: string; service_date: string; end_date: string }>;

  for (const m of maintRows) {
    const mStart = new Date(m.service_date).getTime();
    const mEnd = new Date(m.end_date).getTime();
    if (startMs < mEnd && endMs > mStart) {
      return {
        hasConflict: true,
        reason: `Vehicle ${vehicle.registration_plate} has scheduled maintenance (${m.maintenance_type}) during this period (MNT-03)`,
      };
    }
  }

  const settingBuffer = db.prepare("SELECT value FROM system_settings WHERE key = 'booking_buffer_minutes'").get() as { value: string } | undefined;
  const defaultBuffer = customBufferMinutes !== undefined ? customBufferMinutes : Number(settingBuffer?.value ?? 0);

  // Check existing bookings — including PENDING_APPROVAL (Revision #4: block car even if not approved yet)
  const bookings = db
    .prepare(
      `SELECT id, trip_request_id, start_time, end_time, buffer_minutes, status, purpose
       FROM bookings
       WHERE vehicle_id = ? AND status IN ('PENDING_APPROVAL', 'ACTIVE', 'IN_PROGRESS')`
    )
    .all(vehicleId) as Array<{
    id: number;
    trip_request_id: number | null;
    start_time: string;
    end_time: string;
    buffer_minutes: number;
    status: string;
    purpose: string;
  }>;

  for (const b of bookings) {
    if (excludeBookingId && b.id === excludeBookingId) continue;
    if (excludeTripRequestId && b.trip_request_id === excludeTripRequestId) continue;

    const bStart = new Date(b.start_time).getTime();
    const bEnd = new Date(b.end_time).getTime();
    const bufferMs = Math.max(0, Math.min(defaultBuffer, b.buffer_minutes ?? 0)) * 60000;

    // Strict overlap check: [startMs, endMs] vs [bStart, bEnd + buffer]
    if (startMs < bEnd + bufferMs && endMs + bufferMs > bStart) {
      const stateLabel = b.status === 'PENDING_APPROVAL' ? 'Pending Approval reservation' : 'Active booking';
      return {
        hasConflict: true,
        conflictingBookingId: b.id,
        reason: `Vehicle ${vehicle.registration_plate} is already blocked by ${stateLabel} #${b.id} (${b.start_time} to ${b.end_time}) (BKG-02)`,
      };
    }
  }

  return { hasConflict: false };
}

/**
 * Checks whether a driver is eligible and free for [startTimeIso, endTimeIso].
 * Implements DRV-03, DRV-04, ASN-03, ASN-06, and Revision #4 (blocks driver on unapproved/pending trips too).
 */
export function checkDriverConflict(
  db: AppDatabase,
  driverProfileId: number,
  startTimeIso: string,
  endTimeIso: string,
  excludeTripRequestId?: number,
  excludeBookingId?: number
): ConflictCheckResult {
  const driver = db
    .prepare(
      `SELECT dp.id, dp.full_name, dp.licence_expiry, dp.availability_status, u.is_active, u.approval_status
       FROM driver_profiles dp
       JOIN users u ON u.id = dp.user_id
       WHERE dp.id = ?`
    )
    .get(driverProfileId) as
    | {
        id: number;
        full_name: string;
        licence_expiry: string;
        availability_status: string;
        is_active: number;
        approval_status: string;
      }
    | undefined;

  if (!driver) {
    return { hasConflict: true, reason: 'Driver profile not found' };
  }

  if (driver.is_active === 0 || driver.approval_status !== 'APPROVED') {
    return { hasConflict: true, reason: `Driver ${driver.full_name} account is not active (DRV-01)` };
  }

  if (driver.availability_status !== 'Active') {
    return {
      hasConflict: true,
      reason: `Driver ${driver.full_name} is currently unavailable (${driver.availability_status}) (DRV-04)`,
    };
  }

  const expiryMs = new Date(driver.licence_expiry).getTime();
  const endMs = new Date(endTimeIso).getTime();
  const startMs = new Date(startTimeIso).getTime();
  if (Number.isNaN(expiryMs) || expiryMs < endMs) {
    return {
      hasConflict: true,
      reason: `Driver ${driver.full_name} licence expires on ${driver.licence_expiry} before trip end (ASN-06)`,
    };
  }

  const activeAssignments = db
    .prepare(
      `SELECT a.id, a.trip_request_id, a.booking_id, a.effective_start, a.effective_end,
              tr.status as trip_status, b.status as booking_status
       FROM assignments a
       LEFT JOIN trip_requests tr ON tr.id = a.trip_request_id
       LEFT JOIN bookings b ON b.id = a.booking_id
       WHERE a.driver_profile_id = ? AND a.is_current = 1`
    )
    .all(driverProfileId) as Array<{
    id: number;
    trip_request_id: number | null;
    booking_id: number | null;
    effective_start: string;
    effective_end: string;
    trip_status: string | null;
    booking_status: string | null;
  }>;

  for (const a of activeAssignments) {
    if (excludeTripRequestId && a.trip_request_id === excludeTripRequestId) continue;
    if (excludeBookingId && a.booking_id === excludeBookingId) continue;

    const tripClosed = a.trip_status && ['COMPLETED', 'REJECTED', 'CANCELLED'].includes(a.trip_status);
    const bookingClosed = a.booking_status && ['COMPLETED', 'CANCELLED'].includes(a.booking_status);
    if (tripClosed || bookingClosed) continue;

    const aStart = new Date(a.effective_start).getTime();
    const aEnd = new Date(a.effective_end).getTime();

    if (startMs < aEnd && endMs > aStart) {
      return {
        hasConflict: true,
        conflictingAssignmentId: a.id,
        reason: `Driver ${driver.full_name} is already assigned/blocked during ${a.effective_start} to ${a.effective_end} (ASN-03)`,
      };
    }
  }

  return { hasConflict: false };
}
