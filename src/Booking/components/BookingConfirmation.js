import { Link } from "react-router-dom";
import {
  EASTERN_TIME_ZONE,
  formatTime,
} from "../utils/bookingFormatters";
import { getBookingStatusPresentation } from "../utils/bookingHelpers";

export default function BookingConfirmation({ confirmation }) {
  const statusPresentation = getBookingStatusPresentation(confirmation);
  const appointmentTime = new Date(confirmation.startAt);
  const hasAppointmentTime = !Number.isNaN(appointmentTime.getTime());
  const serviceName = confirmation.service || "Appointment";

  return (
    <main className="booking" aria-labelledby="booking-title">
      <section className="booking__panel booking__confirmation">
        <div className={`booking__confirmation-mark booking__confirmation-mark--${statusPresentation.tone}`} aria-hidden="true">{statusPresentation.mark}</div>
        <p className="booking__eyebrow">{statusPresentation.eyebrow}</p>
        <h1 id="booking-title">{statusPresentation.title}</h1>
        <p>{statusPresentation.message}</p>
        {hasAppointmentTime && <p>{serviceName} is scheduled for {formatTime(confirmation.startAt)} on {new Intl.DateTimeFormat("en-US", { timeZone: EASTERN_TIME_ZONE, dateStyle: "full" }).format(appointmentTime)}.</p>}
        {confirmation.id && <p className="booking__reference">{statusPresentation.status === "ACCEPTED" ? "Confirmation" : "Reference"} #{confirmation.id}</p>}
        <Link className="booking__button" to="/">Return home</Link>
      </section>
    </main>
  );
}
