export default function BookingProgress({ step }) {
  return <ol className="booking__steps booking__progress" aria-label="Booking progress">{["Service", "Date", "Time", "Details", "Confirmed"].map((label, index) => <li key={label} className={step >= index + 1 ? "is-active" : ""}><span className="booking__step-number">{index + 1}</span><span className="booking__step-label">{label}</span></li>)}</ol>;
}
