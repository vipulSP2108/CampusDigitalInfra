// IITGN Maintenance Request System - Ticket Lifecycle & Archival Configuration
// Defines configurable retention windows, grace periods, and automated secondary storage timings.

export const LIFECYCLE_CONFIG = {
  /**
   * Grace period (in days) during which a resident can reopen a request
   * that was marked CLOSED (by admin, staff, or resident).
   * Default: 3 days.
   */
  ADMIN_CLOSED_REOPEN_GRACE_DAYS: Number(process.env.ADMIN_CLOSED_REOPEN_GRACE_DAYS) || 3,

  /**
   * Cooldown grace period (in days) before closed requests move to secondary storage.
   * For admin-closed tickets: 3 days.
   * For user/resident-closed tickets: 15 minutes.
   * Default: 3 days (admin default).
   */
  USER_CLOSED_ARCHIVE_DELAY_DAYS: 3,

  /**
   * User/resident-closed tickets grace period in minutes (15 min per spec).
   * Admin-closed tickets use ADMIN_CLOSED_REOPEN_GRACE_DAYS (3 days).
   */
  USER_CLOSED_ARCHIVE_DELAY_MINUTES: 15,

  /**
   * Retention period (in days) in the secondary / temp archival database
   * before the request and its audit records are permanently purged from the system.
   * Default: 180 days.
   */
  ARCHIVE_PURGE_RETENTION_DAYS: Number(process.env.ARCHIVE_PURGE_RETENTION_DAYS) || 180,
};

/**
 * Checks if a ticket closed by an admin or user is still within the 3-day reopen window.
 */
export function isWithinAdminReopenWindow(closedAt: Date | string | null | undefined): boolean {
  if (!closedAt) return true;
  const closedTime = new Date(closedAt).getTime();
  const maxAllowedTime = closedTime + LIFECYCLE_CONFIG.ADMIN_CLOSED_REOPEN_GRACE_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() <= maxAllowedTime;
}

/**
 * Checks if a ticket closed has exceeded the 3-day grace window and is due for secondary storage.
 */
export function isAdminClosedArchiveDue(closedAt: Date | string | null | undefined): boolean {
  if (!closedAt) return false;
  const closedTime = new Date(closedAt).getTime();
  const maxAllowedTime = closedTime + LIFECYCLE_CONFIG.ADMIN_CLOSED_REOPEN_GRACE_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() > maxAllowedTime;
}

/**
 * Checks if a user/resident-closed ticket has exceeded the 15-minute grace window and is due for secondary storage.
 */
export function isUserClosedArchiveDue(closedAt: Date | string | null | undefined): boolean {
  if (!closedAt) return false;
  const closedTime = new Date(closedAt).getTime();
  const maxAllowedTime = closedTime + LIFECYCLE_CONFIG.USER_CLOSED_ARCHIVE_DELAY_MINUTES * 60 * 1000;
  return Date.now() > maxAllowedTime;
}

/**
 * Calculates the exact purge date (180 days from archive timestamp).
 */
export function calculatePurgeDate(archivedAt: Date = new Date()): Date {
  const purge = new Date(archivedAt);
  purge.setDate(purge.getDate() + LIFECYCLE_CONFIG.ARCHIVE_PURGE_RETENTION_DAYS);
  return purge;
}

/**
 * Unified check: is this closed ticket due for archival?
 * Respects who closed it: admin/staff = 3 days, requester = 15 minutes.
 */
export function isClosedTicketArchiveDue(closedAt: Date | string | null | undefined, closedByRole?: string | null): boolean {
  if (!closedAt) return false;
  if (closedByRole === "requester") {
    return isUserClosedArchiveDue(closedAt);
  }
  // admin, staff, or unknown -> admin grace window
  return isAdminClosedArchiveDue(closedAt);
}
