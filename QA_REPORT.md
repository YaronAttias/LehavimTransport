# QA report — 16 October 2026

## Result

All executed checks passed after fixing time-field input handling. Production registrations were not changed by QA. Mutating integration and browser checks used a separate local Cloudflare D1 database at `.wrangler/qa-state`, served only on `127.0.0.1:5180`.

## Automated checks

- `npm test`: 13 passing tests in `transport.test.mjs` and `overview.test.mjs`.
- `npm run test:types`: TypeScript passed with no diagnostics.
- Sites production build: passed after the fix.
- `npm run test:integration`: passed against real local D1. Checks anonymous access, six children, independent outbound/return registrations, attendance retaining assignments, optimistic concurrency conflicts, activity editing and imports preserving assignments.
- OCR executed on both supplied reference images. Correct activity days, arrival/start times, calculated return times and Sunday week dates were verified. OCR of arbitrary text/date headers is not guaranteed; the app requires preview and confirmation.

## Edge cases covered

- Six children: two 5-seat cars or one 7-seat car.
- Five children: two 5-seat cars are still required; spare seats across two cars must not incorrectly imply one is enough.
- Two late absences after assignment: four children can use one 5-seat car; both bookings stay until parents coordinate.
- An assigned driver's child is absent: retain the driver, flag that the ride needs confirmation.
- No children attend: retain existing bookings and request coordinated cancellation; do not advertise missing cars.
- Attendance restored: remove obsolete warnings and recalculate capacity.
- Outbound and return trips, and different days, remain independent.
- Duplicate absence updates do not duplicate child IDs; invalid child IDs cannot modify the state.
- Two simultaneous attendance writes: one succeeds, the stale write returns 409; a refreshed retry preserves both changes.
- Schedule import preserves existing attendance and assignments; invalid imports do not partially save.
- Past-day collapsing follows Israel midnight in summer and winter; today and future days remain open by default.

## Browser checks

Executed in the Codex in-app browser on Windows, using desktop layout at 1440 px and phone layouts at 390 px and 320 px. These are viewport simulations, not physical-device or cross-browser certification.

- No horizontal page overflow in the tested layouts.
- Day and attendance panels open/close; day headers can be toggled with keyboard Enter.
- Two late absences display a blue-violet table cell and the one-car coordination note.
- An absent assigned driver's child displays the ride-confirmation note.
- All children absent displays the cancellation coordination note while preserving assigned names.
- Restoring attendance removes review highlights without deleting bookings.
- Activity creation, changing its name, and saving were exercised through the UI.
- Changing start time to 19:00 now immediately computes and saves return at 20:30.
- Image upload, preview, editing preview time fields, and saving a separate imported week were exercised through the UI.
- Registering two 5-seat outbound cars and a separate 7-seat return car updates the table correctly.
- No JavaScript console errors were captured during the final browser checks.

## Defect fixed during QA

Time inputs could show a newly entered value without updating the React state used for saving. Time inputs now handle input events directly, and the activity form reads actual named time values when saving. Retesting confirmed 19:00/20:30 in the UI and saved database.

## Re-running

Run `npm test` and `npm run test:types` from the project directory. The integration script deliberately targets only localhost port 5180 and refuses to run against an occupied database: start the built Worker with a fresh, isolated local D1 state path and apply the schema migration before `npm run test:integration`.

## Mobile readability update — 16 October 2026

- Explicit device-width viewport, initial scale 1 and viewport-fit cover. Pinch zoom is not disabled or capped.
- Mobile base text and driver names: 16 CSS px at the default root size; secondary messages: 14 CSS px. Typography uses rem units.
- Navigation buttons measured at approximately 48 CSS px high. Form text fields measured at 16 CSS px.
- At mobile widths the same semantic summary table is laid out as day blocks, each showing day/date/arrival above outbound and return lists. Desktop retains the five-column table.
- Explicit table/row/cell roles retain accessible relationships when the visual display uses grid.
- Safe-area insets and dynamic viewport height handling are included for iPhone layouts.
- Image loading includes an HTMLImageElement fallback when createImageBitmap is unavailable.
- Simulated widths tested: 320, 375, 390, 430 and 448 CSS px. No horizontal page overflow; driver text remained 16 px across all tested widths. The editing modal fit the available viewport and used 16 px input text.
- All 13 automated logic tests and TypeScript checks passed after the mobile changes.
- These checks used the in-app browser. Safari/iOS and physical Pixel/iPhone hardware have not been directly tested here.
- Guidance consulted: MDN viewport documentation, Android accessibility touch-target guidance and WebKit safe-area guidance.


## Performance update — 2026-10-16

- Baseline production curl sample: HTML TTFB 0.678s, state API 0.919s. These are individual network samples, not mobile benchmark averages.
- Render the board and initial state on the server; raw local HTML contains the schedule and drivers, with no loading placeholder. No additional initial browser state request on successful SSR. Responses remain no-store.
- Dashboard client chunk: 36,011 to 23,584 bytes before compression (34.5% reduction). ScheduleImport loads only on entering administration; OCR remains deferred until upload.
- Existing-state reads use one SELECT without the previous initialization write. Background polling pauses when hidden; unchanged revisions preserve the data object.
- Verified local production build, type checks, 15 automated tests, server-rendered HTML and administration/import UI. Physical mobile/network benchmarks not performed.
- Weekly-board title updated to לוח ההסעות לבחירת שיבוץ.


## Netlify migration — 16 October 2026

- Public project: gvaot-bar-rides (4e23f399-0d1e-4242-a7e8-f625900f15c8). Independent QA project: gvaot-bar-rides-qa (08e3727a-a1b7-4ba0-85b6-624f131532c6), returned to private access after checks.
- 17 automated logic/render/API/Postgres tests passed, including canonical Origin validation behind the Netlify internal proxy. TypeScript and Next.js production builds passed.
- Ten remote integration scenarios passed against the QA project's real Netlify Postgres database: activity editing, directions/capacity, five/four passengers, absent drivers, all absent, restoring attendance, simultaneous writes/409/retry, import preservation, atomic invalid imports, invalid IDs/days and foreign origins. The script refuses writes outside the dedicated QA hostname.
- Browser: all six tested widths (320/375/390/430/448/1440) fit without horizontal overflow. Base and driver text measured 16px. Future days open, attendance initially closed, review cells blue-violet and coordination notes visible.
- Browser QA attendance change displayed the driver-confirmation note; restoring attendance removed it without removing the rides.
- Browser QA activity edit saved 19:00 start and 20:30 return.
- Original 1.jpg uploaded and OCR preview checked in Netlify QA. Preview week and start time edited, 20:30 return computed, and import saved successfully. Both original images were additionally processed through the OCR regression script; active days and activity times matched the reference schedules. Header OCR still requires manual preview as documented.
- Two deployment defects caught before handoff: no-build publication of the original .next build omitted static asset URLs, and request.url used an internal origin. Use a full target-specific Netlify build and TRANSPORT_PUBLIC_ORIGIN in both Builds and Functions. Never recycle a QA server bundle into production without rebuilding the target environment.
- Netlify's injected badge script produced a MutationObserver console error; no application logic error was observed after the fixes. Physical Safari/iPhone/Pixel hardware was not directly tested.


## Final production verification — 17 October 2026

Completed against https://gvaot-bar-rides.netlify.app/ after the final production deployment (6ad277cc9ab2dd2890901548).

- Public API: 200, no-store, six children and two weeks. Production revision stayed at 34 throughout the API and browser checks. The migration snapshot was revision 32; later user changes were retained, not reset.
- All seven unique initial/RSC JavaScript and CSS assets were accessible with the correct content type. Server-rendered schedule and viewport metadata present.
- Valid production Origin accepted for validation; foreign/missing Origin rejected (403), including a spoofed forwarded-host header. Stale revision rejected (409). Invalid car size, child, day and schedule import rejected (400). All rejection tests left the complete data and revision unchanged.
- Browser viewports 320, 375, 390, 430, 448 and 1440: no horizontal overflow, 16px base and driver text, approximately 48px navigation buttons. The edit modal fit 320px and time inputs remained 16px.
- Saturday opened week 18–22 October. Future activity cards open; attendance panels closed. Previous-week cards collapsed and could be opened. Attendance panel opened and showed all six children. Inactive/personal days remained hidden.
- Administration and lazy import module loaded. Add-day and edit-day dialogs opened. Changing start to 19:00 computed 20:30 return. Dialogs were cancelled without saving production data. Copy-link confirmation displayed.
- A fresh reload followed by administration/weekly navigation worked; no JavaScript errors captured after the fresh reload.
- Positive writes (bookings, absences, concurrency retries, imports and saved time edits) remain covered by the earlier ten integration scenarios and browser checks on the separate Netlify QA database. No real parent bookings or attendance were changed for these final production checks.
- Physical Safari/iPhone/Pixel hardware testing remains outside the checks performed here.

Result: final production verification passed. Machine-readable evidence: outputs/migration/production-verification.json (checkout-local, ignored by Git).


## Production performance follow-up — 17 October 2026

See PERFORMANCE_REPORT.md. Initial content is visible in approximately 0.39–0.58s in the measured existing-cache browser, but immediate post-reload admin clicks failed to open the tab in 4/5 attempts and immediate week navigation failed in 3/3 attempts. Stable, already-interactive tab transitions were below 0.65s including automation overhead. This is an interaction-readiness finding; the performance test made no production changes. Full details and limitations are recorded in the dedicated report.

## Navigation readiness fix — 17 October 2026

The initial-load performance issue was addressed with native links for the weekly/admin tabs and previous/current/next week. The requested view and validated Sunday date are rendered on the server from URL parameters. Navigation remains browser-native after hydration, avoiding competing React click replay/state updates. This intentionally performs a page request when changing these views; it does not write transport data.

All 20 automated tests pass, including three navigation cases (native destinations, historical Sundays/tab selection, invalid or duplicate parameters). The production build also checks TypeScript.

Final isolated QA deployment: 6ad336611ee225397b919819. Six immediate post-load clicks (three admin and three previous-week) passed. Measured click-to-visible target was 490–819 ms, including automation overhead and existing browser cache. Earlier intercepted-link attempts remained inconsistent and were replaced; they were not deployed to the public site.

### Final production result

Production deployment 6ad33702538d63093c53da57 is live at https://gvaot-bar-rides.netlify.app/.
Eight immediate post-load clicks passed (5 administration, 3 previous-week), with no lost navigation. Administration: 452–1072 ms; previous-week: 521–1352 ms, including automation overhead. Existing cache was used; these are not Web Vitals or physical mobile-network measurements.

Direct HTTP rendering of admin/historical week, weekly/historical week, Saturday default and invalid-date fallback passed (276–347 ms). All six unique initial JavaScript/CSS assets returned 200. A rejected invalid action returned 400 and production data and revision remained exactly unchanged at revision 34.

Viewports 320, 448 and 1440 passed overflow checks in both views; mobile navigation targets remained approximately 48px. Switching tabs preserved the historical week. Copy-link confirmation passed. No new errors appeared after the final fresh reload. One earlier MutationObserver error was captured during browser automation; a Netlify HUD script is present, and its source was not conclusively attributed. It did not reproduce in the final reload or block any navigation checks.

The full remote write suite was not repeated on production: it remains covered by the earlier isolated QA runs. No production booking or attendance was altered. HTTP evidence: outputs/performance/navigation-production-http.json.

## Booking responsiveness regression — 17 October 2026

Automated checks in booking.test.mjs simulate a pending server response and verify that the outbound booking appears immediately, return bookings remain unchanged, a double click sends only one request, and success uses the returned board without an extra GET. A rejected write (409) restores the board, refreshes shared state and shows the error. transport.test.mjs also verifies that POST returns the committed board and revision. These run in the standard npm test suite.

Manual QA scenario (to repeat for outbound, return, vehicle-size update and cancellation): use the isolated QA site with network throttling, select a child and click a booking action. The board and overview should change immediately while ״שומר…״ is visible; confirmation follows server success. Repeat with a rejected write or connection failure: no false success, an error is visible and the board recovers. Start a periodic refresh before clicking and ensure its stale response cannot undo the pending booking. Verify saved state after reload and from a second browser. Manual throttled browser checks for this change have not yet been executed.
`npm test`: 23 tests passed. Production Next.js build and TypeScript validation passed.
The responsiveness tests use a component-state harness with mocked React hooks and fetch. They verify update ordering, not browser paint timing or physical-device latency.

## Completed booking QA and additional fix — 17 October 2026

This section supersedes the earlier pending manual throttled-browser checks. Browser tests used the real Next.js application and API with an explicitly enabled in-memory fixture, six fictional children, and a localhost-only network proxy. Production data was not used for writes. The remote QA HTTP integration script encountered Netlify's private-site 401; site protection was retained. The same ten integration scenarios passed against the local fixture API, including concurrency and origin checks. The independent Postgres migration test also passed.

- Outbound and return: the booking and overview appeared while an eight-second POST delay was still pending. The browser automation action plus DOM observation completed in under 0.5s in these samples; this is not a Web Vitals or physical-network measurement.
- Vehicle-size change and cancellation: immediate UI update with saving feedback during the same eight-second delay; other direction retained.
- Rejected write (409): error displayed, optimistic booking removed, controls restored.
- Dropped TCP connection: readable Hebrew error, original board restored, controls available.
- Committed write with lost response: recovery GET recognized the saved booking.
- Hung save: found an unbounded loading state and fixed it. Requests and response-body reads now abort after 12 seconds. Browser verification confirmed timeout message, rollback and enabled controls; recovery does not keep the UI locked.
- Delayed background refresh: ten-second GET delay overlapped a save; the saved booking remained after the stale response. Automated ordering regression also passed.
- Reload and a second tab showed the saved outbound and return assignments.
- Weekly view widths 320, 375, 390, 430, 448 and 1440; admin widths 320, 390, 448 and 1440: no horizontal overflow; select text remained 16px. These are viewport checks, not iOS Safari/Android engine or hardware tests. Admin lazy importer loaded without captured errors.

35 automated tests passed, including a production-build guard that prevents the local fixture adapter from entering production even when its environment flag is set; TypeScript validation passed. Ten local integration scenarios passed. Evidence: outputs/migration/local-qa-result.json and outputs/booking-qa/mobile.png. The local QA server and network proxy were stopped after testing. Physical iPhone/Pixel and real Safari remain unavailable in this Windows environment.

Deployed QA verification: deployment 6ad34726189a09b6cd468f7d. Authenticated browser booking on Monday updated immediately, persisted after reload against the real Netlify Postgres database, and cancellation restored the original empty direction. No production writes. Browser evidence summary: outputs/booking-qa/browser-result.json.

Final production deployment: 6ad347d56eea511ba7268b8f, live at https://gvaot-bar-rides.netlify.app/. Page, API and all six referenced JavaScript chunks returned 200. The application chunk contains the timeout implementation. Production data hash and revision remained unchanged (43). Read-only browser smoke passed: selecting a child enabled booking controls, admin/weekly navigation worked, and no console errors were captured. Evidence: outputs/booking-qa/production-result.json.
