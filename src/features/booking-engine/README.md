# Booking availability engine

Slots, transactional booking, signed management links, cancellation and manager/customer rescheduling are implemented behind `BOOKING_MVP_ENABLED`.

- The engine handles business-local schedules, DST boundaries, time off, lead time, booking horizons and service/provider buffers.
- Booking uses idempotency records and a database exclusion constraint over occupied intervals. Cancellation releases occupied slots.
- Customer rescheduling obtains a signed authorization lasting at most 15 minutes from the management link. The server assigns its operation key and original appointment start. The transaction checks expiry and the original start, serializes operation keys, and rejects changed-payload replays.
- Prices, durations, packages and add-ons are snapshotted on booking. Moving preserves the purchased offering.
- Authorization, rate limits and domain logic live in services; database writes remain in `src/server/repositories/`.
- Hosted activation requires a verified migrated disposable-target rehearsal and explicit approval. A passing unit suite is not a concurrency or production certification.
- Group bookings, room/resource capacity, recurring courses and waitlists are not implemented.

The historical `contracts.ts` and `server/service.ts` extension interfaces are scaffolding; runtime workflows use the existing server services and repositories. This is one application maintained by the sole developer.
