import { isBeforeBooked } from "./constants.js";
import { formatShortDate } from "../../lib/datetime.js";

/**
 * Human-in-the-loop gate for a call date earlier than the lead's Booked
 * date — deliberately a confirmation, not a hard rejection (see
 * isBeforeBooked's docblock: "Import from HubSpot" legitimately backfills
 * real historical meetings that can predate when a lead got tracked here).
 *
 * Both return true when it's fine to proceed — either nothing is out of
 * order, or the user confirmed anyway — and false when the caller should
 * abort the submit.
 */

/** Single-date form: adding or editing one call (CallLogTimeline.jsx). */
export function confirmIfBeforeBooked(callDate, bookedDate) {
  if (!isBeforeBooked(callDate, bookedDate)) return true;
  const bookedLabel = formatShortDate(String(bookedDate).slice(0, 10)) || bookedDate;
  return window.confirm(
    `This meeting date (${callDate}) is before this lead's Booked date (${bookedLabel}). Log it anyway?`
  );
}

/**
 * Multi-date form: importing several engagements from HubSpot at once
 * (ImportFromHubspotPanel.jsx). One confirmation covering everything
 * flagged, not one popup per date — a rep reviewing 5 imported meetings
 * shouldn't get interrupted 5 times.
 */
export function confirmIfAnyBeforeBooked(callDates, bookedDate) {
  const backdated = [...new Set(callDates.filter((d) => isBeforeBooked(d, bookedDate)))];
  if (!backdated.length) return true;
  const bookedLabel = formatShortDate(String(bookedDate).slice(0, 10)) || bookedDate;
  const list = backdated.sort().join(", ");
  return window.confirm(
    `${backdated.length === 1 ? "One of the selected meetings is" : `${backdated.length} of the selected meetings are`} ` +
    `dated before this lead's Booked date (${bookedLabel}): ${list}. Import anyway?`
  );
}
