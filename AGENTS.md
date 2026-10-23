<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Working on Lm3allem Terminal

Read `README.md` first: it describes the product, the architecture, the live setup and the open items.
This file holds the rules for working on it.

## The person you work with
- The owner of this project is **not a developer**. Explain in plain words, one step at a time when they must do something themselves, and keep technical detail out of replies unless asked.
- **Never use the long dash character** anywhere: chat replies, code comments, UI text, Telegram messages, commit messages. Use "-" or "|".
- **Test things yourself** (production build + a real browser, see "Testing") instead of asking them to click through checks. They said testing "is part of your job".
- Never ask for, print or paste secrets (tokens, passwords, keys). Read them from `.env` inside commands, and hand temporary passwords over in a file under `backups/` (git-ignored).
- Confirm before anything destructive on the live database, and take a backup first (`backups/` holds a JSON export from 2026-10-06).

## Language and UI
- The interface is **standard Arabic** (not Moroccan colloquial, not Egyptian). Glossary: المتجر (magazin), البدلات (costumes), الإدارة (admin portal), الصندوق (till), العميل / العملاء (client), الإيجار (rental), القسم (portal), قميص, حذاء, صدرية, سترات, ربطة فراشة.
- Month names stay **Moroccan** (يناير ... ماي ... يوليوز، غشت، شتنبر ... دجنبر): the owner chose this.
- Amounts: always `formatMAD` / `formatSignedMAD` ("1 550,00 درهم"). Never show internal codes: `portalLabel`, `paymentMethodLabel`.
- Brand: colours from the logo, tokens in `app/globals.css` (`--brand` for fills, `--primary` for text). One font: IBM Plex Sans Arabic. No letter-spacing, no forced capitals (they break Arabic).
- Icon-only buttons use `components/ui/IconButton.tsx` (38px target, 10px gaps). Dropdowns holding business values use `CreatableSelect` (new values are added inside the dropdown; there is no separate options screen).
- Dates: `<DateText>` for moments, `formatDay` for picked calendar days. Morocco time comes from the fixed offset in `lib/utils/time.ts`, never from `toLocaleString` or a time-zone name.

## Code rules
- Every server action authorizes itself (`lib/auth/guard.ts`) and validates its input (`parseInput`, `asId` in `lib/validation.ts`). Mutations return `ActionResult` (`lib/actions/result.ts`) with an Arabic message.
- Side effects after a sale or change (activity log, notifications, Telegram) go through `defer` (`lib/utils/defer.ts`) so the counter never waits.
- Owner alerts: `lib/notifications/alerts.ts` (instant), `lib/reports/reports.ts` (briefs and bot answers), `lib/notifications/bot.ts` (commands). The hidden `ghost` account never produces logs or alerts.
- Database changes: write a migration in `prisma/migrations/`. The live Neon database **is production**; the permission classifier blocks `prisma migrate deploy`, so the owner runs it in their own terminal.
- Do not commit `docs/` (it holds `docs/appsheet/Clothes Entry.xlsx`, the owner's file; do not modify it) or anything under `backups/`.
- Commit messages end with the co-author line given by the session. Pushing to `main` deploys to production (Vercel).

## Testing
- `npm run typecheck`, `npm run lint`, `npm run build` must pass. If the build fails on `.next/dev/types`, delete `.next/dev/types` (stale files from a dev server).
- Real checks: `npx next start -p 3000` after a build, then drive it with Playwright (`playwright-core` with the installed Chrome, `channel: "chrome"`). Test accounts use emails ending in `@test.local`; switch them off (or delete them) afterwards.
- When a test creates data on the live database, run it with `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` removed from the environment so nothing reaches the owners' group, and delete what it created.
- Things worth re-checking after UI changes: no page errors at phone width (390px), no sideways scroll, accessibility scan (axe-core) at 0 in both themes.
