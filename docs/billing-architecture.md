# V1.1 billing architecture foundation

Payments are intentionally not implemented. `lib/billing/plans.ts` defines the stable `free` and `pro` plan IDs and their future entitlements. `lib/billing/entitlements.ts` provides deterministic, side-effect-free checks for profiles, exports, cloud workspace access, and premium templates.

The module is separate from UI and is not wired into current flows, so existing customers remain fully functional and no artificial limits go live in V1.1. A future billing service should resolve a user's plan server-side and pass that plan into these helpers; the browser must not be the authority for entitlement decisions.

Stripe can be added later behind a server billing adapter. The adapter should map verified subscription state to `PlanId`, persist a small entitlement snapshot with an update timestamp, and keep webhook handling separate from profile generation and storage. No Stripe SDK, payment screen, checkout route, or billing secret belongs in this milestone.
