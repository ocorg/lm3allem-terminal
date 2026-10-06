# Lm3allem Terminal

Internal ERP / point-of-sale for **Lm3allem Clothing** (Morocco). Arabic-first (RTL), installable as a PWA, built for a shop counter:

| Portal | What it does |
|---|---|
| **Magazin** (retail) | POS, inventory with size/colour variants, caisse (cash drawer), customer credits, product requests, catalogue |
| **Costumes** (suits) | Suit sales POS, **rentals** (7-step lifecycle, guarantee, deposits, cancellation, refunds), rental/sale inventory, clients, caisse |
| **Lm3allem** (back office, admins only) | Dashboard, finances, caisse history, expenses, users & permissions, activity log, alerts, settings (maintenance) |

Stack: Next.js 16 (App Router, `proxy.ts`), React 19, Prisma 7 on Neon Postgres, Auth.js v5 (JWT), next-intl (Arabic), Tailwind 3, Cloudflare R2, Pusher, Telegram alerts. Currency: MAD.

> Next.js 16 differs from older versions (e.g. `middleware.ts` → `proxy.ts`, `next lint` removed). Read `node_modules/next/dist/docs/` before changing framework-level code.

## Roles

| Role | Access |
|---|---|
| `admin` | Everything: all portals, all modules, user management, settings, maintenance bypass |
| `staff` | Only the portals in `portalAccess` and the modules ticked in `modulePermissions`. The **catalogue** is open to every portal member |
| `ghost` | Invisible full-permission account for maintenance/verification. Never listed, never counted, never written to the activity log, no notifications, cannot be edited from the UI. **Created only by script** (`scripts/create-ghost.ts`) |

There is no `superadmin`. Permissions are stored as `{ portal: { module: boolean } }` and defined in one place: [`lib/permissions.ts`](lib/permissions.ts). Modules - magazin: `pos, inventory, caisse, credits, requests`; costumes: `pos, rentals, rental_inventory, clients, caisse`.

## Authentication

Email + password (no PIN).

- Passwords: `bcrypt(HMAC-SHA256(AUTH_PASSWORD_PEPPER, password))`, cost 12, 8+ characters.
- Brute-force protection is **per account in the database** (5 failures → 5-minute lock), enforced for every entry point.
- New and reset passwords are one-time **temporary passwords** shown once to the admin; the user must change them at first login.
- Sessions are JWT but re-validated against the database every 30 s: deactivating a user or changing a role/permission takes effect within seconds. Max age 12 h.
- Sales below the minimum price need a **manager override**: an admin types their email + password, the server returns a 5-minute HMAC-signed token bound to the cashier, and the sale action verifies it. The browser cannot forge "authorized by".

## Security model

**Every server action authorizes itself** (`lib/auth/guard.ts`: `requireUser / requireAdmin / requirePortal / requireModule`). Page-level redirects (layouts, `withModule`) are only UX: actions are reachable by direct POST.

Mutating actions return `ActionResult` (`{ ok: true, data } | { ok: false, code, message }`, see `lib/actions/result.ts`) instead of throwing, because production Next.js strips thrown error messages. The UI shows `result.message`.

Other rules: inputs validated with zod (`lib/validation.ts`); stock changes use guarded atomic updates; create operations carry an idempotency key (`requestId`); guarantee documents (ID cards) go to a **private** R2 bucket and are served only through `/api/files/*` for authorised users; uploads are type-checked by magic bytes; security headers in `next.config.ts`.

## Money rules

- Everything uses Prisma `Decimal` (`lib/utils/money.ts`), amounts have at most 2 decimals.
- **Caisse expected = cash only**: opening + cash sales + cash rental payments/deposits + cash credit repayments − cash deposits/refunds paid out ± manual entries. Card (`tpe`) and bank transfers (`banque`) are reported separately and never counted in the drawer. One implementation (`lib/finance/caisse.ts`) feeds both the live screens and the closing action.
- **Revenue is cash-basis** (`lib/finance/revenue.ts`): sale amounts actually collected + credit repayments + rental payments (`rental_payment`, `remaining_balance`) − `rental_refund`. Refundable deposits (`deposit_collected/returned`) are never revenue.
- One open caisse session per portal (partial unique index).
- Business dates use Morocco time (`lib/utils/time.ts`).

## Rentals

`booked → in_preparation → ready_for_pickup → picked_up → returned → cleaning → available`, plus `cancelled`.

- Stock is reserved at booking and released when the kit is `available` again (or on cancellation).
- Staff cannot hand the kit over while a balance is due, nor close the rental while a collected deposit is not returned (admins can override).
- A rental can be edited (dates, total, notes) and cancelled (with optional refund) until pickup.
- Kit references (`KIT-0001`) and item codes (`ART-0001`) come from atomic counters.
- Guarantee deposits are recorded as `deposit_collected` / `deposit_returned` payments, separate from the rental balance.

## Setup

```bash
npm install
cp .env.example .env            # fill in the values (see comments in the file)
npx prisma migrate deploy       # apply migrations
npm run db:seed                 # lookup lists + default settings (+ first accounts, see below)
npm run dev
```

First accounts (nothing is hardcoded - there is no default login). Either set `SEED_ADMIN_*` / `SEED_GHOST_*` in `.env` before `db:seed`, or use the scripts:

```bash
npx tsx scripts/set-credentials.ts --name "Owner" --email owner@example.com --password "a long password" --role admin
npx tsx scripts/create-ghost.ts   --email ghost@example.com --password "another long password"
```

### Upgrading from the PIN version

Migration `20261005000000_auth_roles_hardening` drops the `pin` column and converts `superadmin` users to `admin`. **Existing users cannot log in until they get credentials:**

1. Back up the database.
2. `npx prisma migrate deploy`
3. For every existing user: `npx tsx scripts/set-credentials.ts --name "<name>" --email <email> --password "<password>"`
4. `npx tsx scripts/create-ghost.ts --email ... --password ...`
5. Set `CLOUDFLARE_R2_PRIVATE_BUCKET_NAME` (a bucket **without** public access) so *new* guarantee photos are private. Photos uploaded before this change keep their old public URLs: move them if they matter.

The migration also recomputes `Rental.amountPaid/balance` from the payment ledger (deposits used to be added to `amountPaid`) and fails loudly if two caisse sessions are open for the same portal - close one first.

### Alerts (Telegram + in-app bell)

Every notification (new rental, caisse opened/closed, low stock) appears in the admin bell and is also sent to Telegram when `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set (see `.env.example`). The "low-stock summary" button on the Alerts screen sends to Telegram too. Actions by the ghost account never notify anyone.

### Overdue alerts

`GET /api/cron/overdue` (header `Authorization: Bearer $CRON_SECRET`) notifies the admin (in-app bell + one Telegram summary) about rentals not returned after their return day. Call it daily from any cron service (Vercel Cron sends the header automatically).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint (`next lint` no longer exists in Next 16) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:seed` | Lookup lists, default settings, optional first accounts |
| `scripts/set-credentials.ts` | Set/reset email + password for an existing user |
| `scripts/create-ghost.ts` | Create or reset the ghost account |

## Project layout

```
app/[locale]/(magazin|costumes|lm3allem)/…   pages (thin: guard + data + client component)
app/api/                                     auth, uploads, private files, pusher auth, cron
lib/actions/                                 server actions per portal ("use server")
lib/auth/                                    credentials, guards, override tokens, password hashing
lib/finance/                                 caisse + revenue arithmetic (single source of truth)
lib/permissions.ts                           roles / portals / modules
components/                                  UI (client components, ui/ primitives)
messages/ar.json                             translations (Arabic only for now)
prisma/                                      schema, migrations, seed
```

The app is Arabic-only: `routing.locales = ["ar"]`. Adding a language means adding a locale to `lib/i18n/routing.ts`, a `messages/<locale>.json`, and making the root layout's `lang`/`dir` locale-aware.

## Offline mode
- Works only in a production build (`npm run build && npm start`); the service worker is not registered in dev.
- Pages already visited stay available offline. POS sales (magazin and costumes) are saved on the device and sent automatically when the connection returns (same request id, so no duplicates). Sales below the minimum price are blocked offline.
- Every other action needs a connection and shows a clear error if it is lost.

## Images and Telegram
- Photos are compressed in the browser to about 200 KB, and again on the server as a safety net.
- Low-stock alerts are sent to Telegram as table pictures (Arabic font bundled in `assets/fonts`).

## Going live checklist
1. Set env vars: `DATABASE_URL`, `AUTH_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, R2 keys incl. `CLOUDFLARE_R2_PRIVATE_BUCKET_NAME`, `CRON_SECRET`. Do not set `AUTH_PASSWORD_PEPPER` if accounts already exist.
2. Apply migrations: `npx prisma migrate deploy` (includes the Arabic labels migration).
3. Schedule a daily call to `/api/cron/overdue` with the `CRON_SECRET`.
4. Test the production build once: login, a sale, offline sale, a rental with dates, a Telegram alert.

## Look and feel
- Brand colours come from the store logo (charcoal `#353535`, orange `#F59A0E`, red `#D02828`). They are defined once in `app/globals.css`: `--brand` is for filled buttons, `--primary` is the same orange tuned so it stays readable as text in each theme.
- One font everywhere: IBM Plex Sans Arabic (Arabic, Latin and digits), with equal-width digits so amounts line up. No letter-spacing and no forced capitals: both break Arabic.
- The logo lives in `public/brand/` and is also the app icon (`app/icon.png`, `public/icons/`).
- Amounts are always written by `formatMAD` (`lib/utils/currency.ts`): "1 550,00 درهم". Internal codes are never shown: use `portalLabel` / `paymentMethodLabel` (`lib/utils/labels.ts`).
- Dates: a moment (sale, login) is shown with `<DateText>`; a picked day (rental dates, expense date) with `formatDay`.

## Checks that were run (and how to think about them)
- Accessibility: automated WCAG 2 A/AA scan of all 22 screens in both themes: 0 violations.
- Permissions: 57 direct server calls as a logged-out visitor and 44 as a limited staff member: all refused.
- Bad input: 67 hostile inputs as an admin (negative or huge amounts, fake roles, script text, impossible dates): all refused.
- Every server action must validate its input shape (`parseInput` / `asId` in `lib/validation.ts`) and authorize itself.

## Business clock and automatic till closing
- Morocco time is a fixed offset in `lib/utils/time.ts` (UTC+0), not read from the server time-zone database, which was one hour wrong. If Morocco changes its clock, set `NEXT_PUBLIC_BUSINESS_UTC_OFFSET_MINUTES` (for example `60`) and redeploy.
- A till not closed by hand is closed automatically at 04:00: by the daily job `/api/cron/close-caisse`, and also the moment anyone opens a till screen. The counted amount stays empty for such a closing; the expected cash is recorded and an alert is sent.
