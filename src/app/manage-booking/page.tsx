import type { Metadata } from "next";
import { Brand } from "@/components/brand";
import { ManageBooking } from "@/features/public-booking/manage-booking";
export const metadata: Metadata = {
  title: "Manage your booking",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <div className="hero-wash min-h-screen">
      <header className="mx-auto max-w-3xl px-5 py-7">
        <Brand />
      </header>
      <main id="main" className="mx-auto max-w-3xl px-5 pb-14">
        {process.env.BOOKING_MVP_ENABLED === "true" ? (
          <ManageBooking />
        ) : (
          <p className="notice">
            Booking management is not enabled. Please contact the business.
          </p>
        )}
      </main>
    </div>
  );
}
