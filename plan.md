# TFC Manager — Build Plan & Working Prompt for Three Agents

> **This document is a prompt.** Three agents work from it: **Sweeper**, **Loom**, and **Atlas**.
> Read your own sections, but read the shared sections first — they bind everyone.
> Build **one milestone at a time**. Each milestone ends with a **Human Test Gate** (the owner
> tries it personally) and a **PM Checkpoint** (Atlas may amend the next tasks). Do not start
> milestone *N+1* until milestone *N* passes its gate.
>
> *Prompt authored by Cue. Revised once for sequencing — see §8 changelog.*

---

## 0. Mission (one-liner)

TFC Manager is a bilingual (Arabic primary / Hebrew, **RTL-first**) mobile + desktop web app that
lets a football-club coach run **attendance, player dues, and staff salaries** from one screen —
so coaching time is spent coaching, not bookkeeping. **UX is the top value:** when feature
completeness fights the coach's ability to act without thinking, the no-think path wins.

**North Star:** % of scheduled sessions with attendance recorded within 24h — target **≥ 95%**.

---

## 1. The three agents — identity, ownership, authority

### 🛡️ Sweeper — Backend & Database Engineer
The last defender who reads the whole pitch and cleans up before trouble reaches goal. Owns:
Supabase (Postgres, Auth, RLS, storage), the data model and its invariants, server actions /
route handlers, offline-sync correctness, security, query performance, **and the automated tests
that prove the data invariants hold.** Enforces invariants at the database, not just the UI. When
in doubt, the DB says no.

### 🧵 Loom — UI / Design Engineer
Weaves intent into interface. Owns: the design system (tokens, type, motion), every screen and
component, RTL layout, shadcn/ui composition, accessibility of the rendered UI, loading/empty/
success states, the feel. Builds the no-think surface the coach touches pitch-side.

### 🧭 Atlas — Product Manager & UX
Holds the map. Owns: scope, priority, the JTBD, acceptance criteria, copy (AR/HE), defaults,
and the right to **amend tasks for Sweeper or Loom** when a deliverable misses the no-think bar
or drifts from the product. Atlas runs the six-filter on every proposed change
(JTBD → Frequency → Decision-burden → Defaults → Replacement → Krug no-think) and writes the
acceptance checklist each milestone is graded against. **Atlas has final say on product
decisions; Sweeper has final say on data integrity; Loom has final say on interaction feel —
conflicts escalate to Atlas.**

### Collaboration protocol
- **Handoff direction per milestone:** Sweeper lands the data + contracts → Loom builds on the
  real contracts (never mocks that drift) → Atlas runs the acceptance checklist → Human Test Gate.
- **Amendments:** If Atlas changes a requirement mid-milestone, Atlas appends a dated
  `> PM AMENDMENT:` line to the affected task and notifies the owning agent. The agent reworks
  only that task; gates already passed are not reopened unless the amendment touches them.
- **Contracts are shared truth:** every server action / table / type Sweeper produces is listed
  in that milestone's **Interfaces** block. Loom consumes exactly those names — no guessing.

---

## 2. Locked architecture (do not relitigate without Atlas sign-off)

Locked with the owner 2026-06-19, plus the auth decision Atlas made for this plan:

- **App:** Next.js (App Router, TypeScript) — **web + PWA, device-adaptive, ONE codebase.**
  Phone → coach app; desktop → owner/manager site. Same deploy, layout adapts to device.
- **Backend:** **Supabase Postgres.** Org `mezhqoggtdussavrfigf`, **new project for football**
  (NOT the existing BasketBall project), region **eu-central-1** (closest to Tayibe/Israel),
  **free tier ($0/mo)**.
- **Auth:** **Supabase Auth, phone OTP (SMS), OTP-only — no password.** *(Atlas decision; this
  supersedes the casual "Firebase OTP" idea — the entire RLS model keys off Supabase
  `auth.uid()`, and any SMS provider costs the same, so Firebase adds parts without saving cost.)*
  - **Cost control = persistence, not provider:** long-lived session + "trust this device" so the
    coach OTPs once and effectively stays signed in (target: no re-OTP for ≥ 90 days of active
    use). This is how we keep SMS spend near zero.
  - **Dev/test:** use a fixed test OTP (Supabase test phone numbers) during the build so we burn
    **zero real SMS** until production.
- **Players:** **ONE `players` table.** `category` enum = `beet_sefer | league | bogrim` drives
  **money direction only**. Bogrim (adults/senior team) take attendance like everyone, but the
  **club pays them** (salaries) — they never appear in dues.
- **Money:** **TWO tables, never one signed-amount table.** `dues` + `payments` for
  beet_sefer + league only; `salaries` for bogrim only. Direction is reversed, so tables are
  separate (avoids the 3am sign bug). Enforce with CHECK + RLS: a Bogrim can never land in dues,
  a kid can never land in salaries.
- **Roles:** `coach | owner | parent` in a `profiles` table (1:1 with `auth.users`). RLS per role.
- **Offline:** `attendance.client_id uuid` device-generated and unique → replay-safe upsert on
  resync, no duplicates. Money logging may queue offline too.
- **UI kit:** **shadcn/ui** + Tailwind (already a project devDependency). Use the shadcn MCP to
  search/add components rather than hand-rolling.
- **Schema management:** all schema changes are **versioned Supabase migrations** (SQL files in
  `supabase/migrations`), never ad-hoc dashboard edits — the schema grows across M1→M6.
- **Deploy target:** **Vercel** (preview per branch, production on main).
- **Skipped (YAGNI):** multi-club dashboards, full audit log, reminders/cron engine, in-app
  payments. Do not build these.

---

## 3. Global constraints (bind every task, every agent)

Copy these values verbatim — every task implicitly includes this section.

- **Language:** Arabic (primary default) + Hebrew, **full parity, RTL-first throughout.**
  Numerals & currency render **LTR-isolated inside RTL** (use IBM Plex Mono, bidi isolation).
- **Accessibility floor:** **WCAG AA.** Touch targets **≥ 44px** (attendance buttons larger).
- **One-handed, sunlight-readable:** primary actions reachable by thumb; high-contrast
  **light theme only.**
- **Offline:** attendance capture works with no network and syncs later; Home surfaces "unsynced
  attendance" as a needs-attention item. Money logging may queue offline.
- **Performance:** instant-paint loading (skeletons + themed loaders), **no blank screens ever.**
- **≤ 5 primary actions per screen** (Hick's Law); Home "quick actions" capped at **3**.
- **Modals only for destructive/one-time decisions** (remove, confirm). Routine actions use inline
  controls or bottom sheets.
- **Status is never ambiguous:** color + label + (where it matters) icon — survives
  colour-blindness and sunlight.

### Visual system (binding)
- **Colors:** Blue `#2563EB` = UI/chrome & nav · Green `#10B981` = primary **action**
  (confirm/present/save) · White `#FFFFFF` = surface · Ink `#0B1A2E` = text. **Light theme only.**
- **Money status (reserved, never reused for chrome):** paid = green `#10B981`, partial =
  amber `#F59E0B`/`#B45309`, overdue = red `#C0392B`, upcoming = blue `#2563EB`.
- **Attendance:** present = green, late = amber, absent = red — **same everywhere.**
- **Type:** IBM Plex Sans Arabic / Hebrew for text; **IBM Plex Mono for all money & numeric
  values** (tabular, LTR-isolated).
- **Motion with meaning:** spinning ball + rolling pitch-lines (loading), breathing crest,
  animated success check, bobbing-ball empty states. **All respect `prefers-reduced-motion`.**
- **Voice:** warm, confident, sporty, effortless — never corporate. Morning greeting is personal
  ("صباح الخير، كابتن أمير"). Money states stay strictly clean.

### Anti-features — do NOT build
In-app card/online payment processing · chat/messaging · league standings/fixtures · gamification
(badges/streaks/leaderboards) · free-form custom player fields (v1) · a separate reports/export
tab (lives in settings) · multi-club/federation dashboards.

---

## 4. How to run this plan (the working loop)

For each milestone **M**:
1. **Sweeper** completes the backend tasks → publishes the Interfaces block (real names/types).
2. **Loom** builds the UI tasks against those exact contracts.
3. **Atlas** runs the milestone's Acceptance Checklist; files PM amendments if anything misses.
4. **Human Test Gate:** the owner uses the slice on a real phone (and desktop where noted). The
   owner's verdict — not the agents' — advances the milestone.
5. Only then start **M+1.**

**Definition of "done" for a task:** the deliverable exists, is wired to real data (no mocks left),
respects every Global Constraint, and passes its stated acceptance criteria.

**Testing split:** Sweeper writes **automated tests for data invariants and RLS** — anything where
a silent failure corrupts money or attendance (the category/money invariant, offline-replay
dedup, parent read-scope). The UI is verified by the **Human Test Gates**. Don't chase coverage on
presentational code; do prove the invariants in code.

**A flow's data must be creatable before that flow's gate.** If a screen needs events, dues, or
ratings to exist, the milestone that ships the screen also ships the way to create that data — we
never gate-test a screen against data with no on-ramp. *(This is the rule the first revision was
about; the events / dues-generation / ratings fixes below all follow from it.)*

---

## 5. Milestone roadmap (basics first, then everything else)

```
M0  Foundation skeleton    ── boots, RTL, bilingual, 5-tab shell, design tokens, migrations
M1  Auth + first owner     ── phone OTP, stay signed in, the first user becomes owner
M2  Players & categories   ── roster + profiles (coach/owner only — parent deferred to M7)
M3  Events & Attendance    ── create sessions + the North Star attendance flow, offline-safe
M4  Money                  ── dues/payments + salaries, monthly generation, invariants tested
M5  Home (morning open)    ── greeting + today + needs-attention
M6  Calendar · Ratings & Analytics · Admin
M7  Parent view            ── tertiary: parent auth + child-link + read-only screens (built late)
M8  Polish · offline · a11y · PWA · metrics · production SMS
```

> **Priority honored:** primary user (coach) and secondary (owner) are served by M1–M6. The
> tertiary user (parent, read-only) is built at **M7**, after the core works — matching the
> product-context ranking. M1 reserves only the `parent` enum slot; no parent logic lands early.

---

## M0 — Foundation skeleton
*Goal: the app boots on phone and desktop, renders RTL, switches AR/HE, shows the 5-tab shell, and looks on-brand. No real features yet — this is the ground to stand on.*

### 🛡️ Sweeper
- [ ] Scaffold Next.js (App Router, TypeScript, ESLint) at repo root; Tailwind; `shadcn init`
      with the brand tokens (see Loom's token list). Set `dir="rtl"` + `lang` at the root layout.
- [ ] Create the Supabase football project (org `mezhqoggtdussavrfigf`, eu-central-1, free tier).
      Add `.env.local` with URL + anon/publishable key. **Never commit secrets.**
- [ ] Initialize **Supabase migrations** (`supabase/migrations`); every later table change is a
      migration file, applied via the CLI/MCP — no dashboard-only edits.
- [ ] Install `@supabase/ssr`; create `lib/supabase/client.ts` (browser) and
      `lib/supabase/server.ts` (server, cookie-based) clients.
- [ ] Set up i18n: Arabic default + Hebrew, message catalogs (`messages/ar.json`, `messages/he.json`),
      a locale switcher, persisted choice. RTL for both.
- [ ] Load IBM Plex Sans Arabic, IBM Plex Sans Hebrew, IBM Plex Mono (self-hosted via `next/font`).
- [ ] Link the repo to **Vercel** (preview deploys per branch).

**Interfaces produced:** `createBrowserClient()`, `createServerClient()`, `useLocale()/setLocale()`,
the token CSS variables (`--color-action`, `--color-chrome`, `--color-ink`, money/attendance vars).

### 🧵 Loom
- [ ] Define the design tokens as CSS variables + Tailwind theme: chrome `#2563EB`, action
      `#10B981`, surface `#FFFFFF`, ink `#0B1A2E`; money + attendance semantic colors; type scale.
- [ ] Build the **device-adaptive app shell**: mobile bottom nav with 5 tabs
      **Home · Players · Calendar · Money · Admin**; desktop side/top nav, same routes.
- [ ] Build the shared **loading skeleton** + a **themed loader** (spinning ball / rolling
      pitch-lines) and a generic **empty state** (bobbing ball). Wire `prefers-reduced-motion`.
- [ ] RTL layout primitives: a `<Money>` component that renders Plex Mono, tabular, LTR-isolated.

**Interfaces produced:** `<AppShell>`, `<TabBar>`, `<Skeleton>`, `<BallLoader>`, `<EmptyState>`,
`<Money value=… />`.

### 🧭 Atlas
- [ ] Write the M0 acceptance checklist (below). Confirm the IA map (5 primary tabs, secondary
      levels) matches product-context. Approve the AR/HE copy keys for nav + shell.

**Acceptance checklist:** app boots with no blank screen · default language Arabic, RTL correct ·
toggling to Hebrew keeps full parity · all 5 tabs navigate · numerals show LTR inside RTL ·
on-brand colors · works on a phone viewport and a desktop viewport · preview deploy is live.

**🧪 Human Test Gate:** Owner opens it on phone → sees an on-brand RTL shell, switches to Hebrew,
taps through all 5 tabs. On desktop → adapts. *Nothing errors, nothing is blank.*

**PM Checkpoint:** Atlas confirms the shell feels right before any feature is built on it.

---

## M1 — Authentication + first-owner bootstrap
*Goal: the coach signs in by phone + OTP, lands in the app, closes it, reopens days later, still signed in. The very first person to sign in becomes the club owner.*

### 🛡️ Sweeper
- [ ] Enable Supabase Auth **phone provider**; configure **test phone numbers + fixed OTP** for
      dev so no real SMS is sent. Document where to add a real SMS provider for production (M8).
- [ ] Create `profiles` table: `id uuid PK references auth.users(id)`, `role` enum
      `coach|owner|parent`, `full_name`, `phone`, `locale`, timestamps. (The `parent` value exists
      now but **no parent-specific logic ships until M7** — it's just a reserved slot.)
- [ ] **First-owner bootstrap trigger:** on `profiles` insert, if no `owner` exists yet, assign
      this user `owner`; otherwise default `coach` (real role assigned via invite in M6). This is
      how an empty, brand-new app gets its first administrator with zero manual seeding.
- [ ] Enable RLS on `profiles`: a user reads/updates **only their own** row; `owner` may read all.
      (Role-agnostic — no parent branch here.)
- [ ] Server actions: `sendOtp(phone)`, `verifyOtp(phone, code)` returning a session. Persist the
      session in a **long-lived cookie** (refresh-token rotation; an active device is not
      re-prompted for ≥ 90 days).
- [ ] `middleware.ts`: protect all app routes; unauthenticated → `/auth`. Refresh the session on
      every request (the `@supabase/ssr` middleware pattern).

**Interfaces produced:** `sendOtp(phone)`, `verifyOtp(phone, code)`,
`getSessionUser()` (server) → `{ id, role, locale } | null`.

### 🧵 Loom
- [ ] **Phone-entry screen:** large RTL-friendly phone field, country prefix, number LTR-isolated;
      primary green "Send code" action (≥ 44px); inline error states.
- [ ] **OTP-entry screen:** 6 single-digit boxes, auto-advance + paste, **resend with cooldown**,
      loading state on verify, animated success → route into Home.
- [ ] A subtle **"trust this device"** affordance (default on) explaining they'll stay signed in.
- [ ] Warm error copy (wrong code, expired, too many attempts) — never raw error text.

### 🧭 Atlas
- [ ] **Decision recorded:** OTP-only, no password (Krug no-think). Persistence is the cost lever.
- [ ] Confirm the bootstrap rule (first user = owner) is acceptable for this single-club product.
      Approve OTP copy (AR/HE), cooldown length, and the < 30s no-think sign-in bar.

**Acceptance checklist:** phone → OTP → app in < 30s · dev uses fixed OTP (no real SMS) · wrong
code shows a warm message · **close app, reopen later → still signed in** · the first signup is
`owner`, the second is `coach` · protected routes redirect when logged out.

**🧪 Human Test Gate:** Owner signs in (first user → becomes owner), force-quits, reopens → still in.
Logs out → bounced to `/auth`.

**PM Checkpoint:** Atlas confirms persistence holds (the SMS-cost lever) before moving on.

---

## M2 — Players & categories (coach/owner only)
*Goal: add players across the three categories, browse rosters, open a profile. Get the load-bearing split right: Bogrim ≠ dues, kids ≠ salaries. **Parent access is NOT built here — deferred to M7.***

### 🛡️ Sweeper
- [ ] Create `players` table: `id`, `category` enum `beet_sefer|league|bogrim`, `full_name`,
      `national_id`, `birthdate`, `jersey_number`, `position`, `height_cm`, `guardian_name`,
      `guardian_phone`, `active bool`, timestamps. Fixed fields only (no custom fields v1).
- [ ] RLS: **coach/owner only**, scoped by category visibility (a `profiles` field or join table
      sets which categories a member sees). **No parent branch yet** — parent RLS lands in M7 so
      the foundational policies stay simple and don't carry the tertiary user from day one.
- [ ] CRUD server actions: `createPlayer`, `updatePlayer`, `deactivatePlayer` (soft, preserves
      history), `listPlayers(category)`, `getPlayer(id)`.

**Interfaces produced:** `Player` type, `listPlayers(category)`, `getPlayer(id)`,
`createPlayer(input)`, `updatePlayer(id, patch)`, `deactivatePlayer(id)`.

### 🧵 Loom
- [ ] **Players tab:** three category roster lists (Beet Sefer / League / Bogrim), each a clean
      scannable list of player cards (name, jersey, status chip). Empty states per category.
- [ ] **Player profile screen (identity section):** age, national ID, jersey, position, height,
      guardian. Mono for numerics. Edit affordance (owner/coach by permission).
- [ ] Add-player flow with category fixed by which roster you entered from.

### 🧭 Atlas
- [ ] Verify the invariant in copy + IA: Bogrim reads as "senior team / salaried," kids read as
      "dues." Confirm fixed-field set; resist field sprawl. Write acceptance.

**Acceptance checklist:** add a player to each category · rosters list correctly · profile shows
fixed fields · deactivate preserves the row · RLS is coach/owner only (parent untouched here).

**🧪 Human Test Gate:** Owner adds a Beet Sefer kid, a League kid, a Bogrim adult; opens each
profile; deactivates one and sees history intact.

**PM Checkpoint.**

---

## M3 — Events & Attendance (the North Star, offline-safe)
*Goal: create training/match sessions, then mark a 22-player roster present/late/absent in under 60s, with reasons, fully offline, syncing later with no duplicates. **Events are creatable here — the attendance gate depends on it.***

### 🛡️ Sweeper
- [ ] `events` table: `id`, `category` (or team), `title`, `starts_at`, `location`, `type`
      enum `training|match`, timestamps. Actions: **`createEvent`, `updateEvent`, `deleteEvent`**,
      `getTodaySessions()`, `listEvents(range)`, `getEventRoster(eventId)`. *(Event creation lands
      now, not at M6 — attendance has nothing to attach to otherwise.)*
- [ ] `attendance` table: `id`, `event_id`, `player_id`, `status` enum `present|late|absent`,
      `reason_minutes int null`, `reason_cause text null`, **`client_id uuid UNIQUE`**,
      `recorded_at`, `synced_at`. Replay-safe **upsert on `client_id`** so offline resync never
      duplicates. RLS: coach/owner write within visibility.
- [ ] Offline queue: client writes attendance locally (IndexedDB) with a generated `client_id`;
      `syncAttendance(batch)` upserts on reconnect.
- [ ] **Automated test:** simulate an offline batch synced twice → assert each `client_id` yields
      exactly one row (no dupes). This is the offline correctness guarantee.

**Interfaces produced:** `createEvent(input)`, `updateEvent(id, patch)`, `getTodaySessions()`,
`listEvents(range)`, `getEventRoster(eventId)`,
`saveAttendance(eventId, rows[])`, `syncAttendance(batch)`, `getUnsynced()`.

### 🧵 Loom
- [ ] **Minimal create-session flow:** title, type (training|match), category/team, date-time,
      location. Enough to schedule a session the owner can immediately take attendance for. (The
      rich calendar overview comes in M6; this is just "make a session exist.")
- [ ] **Event → roster attendance screen:** per player, three **big** targets present/late/absent
      (larger than 44px), one-thumb reachable. Live **progress ring** as you go.
- [ ] **Reason sheet:** auto-prompts on late/absent — minutes input + cause **chips**; sensible
      default; present needs zero extra taps.
- [ ] **Save → animated success** with present/late/absent breakdown. **Offline indicator** +
      "will sync" reassurance; queued rows look saved, not pending-scary.

### 🧭 Atlas
- [ ] Guard the no-think + speed bar: **≤ 60s for 22 players**; present is zero-extra-tap. Confirm
      creating a session is also no-think. Define the "unsynced attendance" needs-attention
      contract for Home (M5). Acceptance.

**Acceptance checklist:** owner can **create a session**, then mark 22 players in ≤ 60s ·
late/absent prompt a reason, present doesn't · go offline mid-roster, finish, reconnect → syncs
once, **no duplicates** (and the dedup test passes) · success screen shows the breakdown.

**🧪 Human Test Gate:** Owner creates a training session, takes attendance for a full roster timed
under a minute, turns off network, takes another, turns it back on → everything syncs cleanly, no
duplicates.

**PM Checkpoint:** the North Star — Atlas passes it only on the timed, offline-tested run, not on
"looks fine."

---

## M4 — Money (dues/payments + salaries, generated + invariant-tested)
*Goal: generate a month's dues and salaries, record a cash payment in 2 taps, see remaining balances and the overdue list — with the DB refusing any wrong-category row, proven by a test.*

### 🛡️ Sweeper
- [ ] `dues` table (beet_sefer + league only): `id`, `player_id`, `period` (month), `amount_due`,
      `due_date`, `status` derived (paid|partial|overdue|upcoming). **UNIQUE(player_id, period)**.
      **CHECK/RLS: player.category ∈ {beet_sefer, league}** — reject Bogrim.
- [ ] `payments` table: `id`, `due_id` (or player+period), `amount`, `method` enum
      `cash|transfer`, `paid_at`, `client_id uuid UNIQUE` (offline-safe), `recorded_by`.
- [ ] `salaries` table (bogrim only): `id`, `player_id`, `period`, `amount`, `status`, `paid_at`.
      **UNIQUE(player_id, period)**. **CHECK/RLS: player.category = bogrim** — reject kids.
- [ ] **Monthly generation (owner-triggered, idempotent):** `generateDues(period)` creates one
      dues row per active kid at the default amount; `generateSalaries(period)` one per active
      Bogrim. Re-running the same period is a no-op (the UNIQUE constraint). *(This is the missing
      lifecycle — rows don't appear by magic; the owner generates the month, no cron needed.)*
- [ ] `recordPayment(playerId, amount, method)` with **remaining-balance** computation;
      `getOverdue()`; offline queue for payments.
- [ ] **Automated invariant test (required):** attempt to insert a Bogrim into `dues` and a kid
      into `salaries`; assert **both are rejected** by the DB. This is the highest-consequence
      correctness property in the app and is not left to manual clicking.

**Interfaces produced:** `generateDues(period)`, `generateSalaries(period)`,
`getPlayerBalance(playerId)` → `{ due, paid, remaining, status }`, `recordPayment(...)`,
`listDues(filter)`, `listSalaries(filter)`, `getOverdue()`.

### 🧵 Loom
- [ ] **Money tab** with **Dues / Salaries** sub-tabs (Salaries = Bogrim only; Dues = kids only —
      never mixed).
- [ ] **"Generate this month"** action per sub-tab (owner) → creates the period's rows.
- [ ] **Record-payment bottom sheet (2-tap happy path):** pick player → **amount pre-filled to
      remaining** → method **cash by default** → confirm. Common case = zero typing.
- [ ] Money status everywhere via the reserved semantics (paid green / partial amber / overdue red
      / upcoming blue), **Plex Mono** numerals, status = color + label.
- [ ] **Overdue list** view for owner (who, how much, how late).

### 🧭 Atlas
- [ ] **Regression alarm:** payment happy path stays **= 2 taps**; flag if it climbs. Default dues
      amount + default method (cash) are hidden defaults, not prompts. Acceptance.

**Acceptance checklist:** owner generates a month's dues + salaries · record a cash payment in
**2 taps**, remaining updates live · overdue list correct · a Bogrim **cannot** be inserted into
dues and a kid **cannot** into salaries (**the invariant test passes**) · numerals mono + LTR.

**🧪 Human Test Gate:** Owner generates the month, logs a cash payment in two taps, watches the
balance drop, opens the overdue list. Sweeper shows the invariant test passing (wrong-category
inserts rejected).

**PM Checkpoint.**

---

## M5 — Home (morning open) + needs-attention
*Goal: the coach opens the app and instantly sees the day and what needs attention — one tap into each. (All its data — events, dues, unsynced attendance — now exists from M3/M4.)*

### 🛡️ Sweeper
- [ ] Aggregations (bounded queries): `getTodaySessions()` (reuse M3),
      `getNeedsAttention()` → overdue dues count + unsynced attendance count. Cheap; runs on every
      open. `getHomeData()` composes them with the greeting name.

**Interfaces produced:** `getHomeData()` → `{ greetingName, today: Session[], attention: AttentionItem[] }`.

### 🧵 Loom
- [ ] **Home screen:** personal greeting ("صباح الخير، كابتن أمير" / Hebrew parity), today's
      sessions list, **needs-attention** cards (overdue dues, unsynced attendance) each → one tap
      into the relevant flow.
- [ ] **Quick actions capped at 3** (e.g., take attendance, record payment, add player). Nothing
      the coach needs in the first second sits below the fold.

### 🧭 Atlas
- [ ] Enforce Hick: ≤ 5 primary actions, ≤ 3 quick actions. Confirm the morning-open JTBD. Acceptance.

**Acceptance checklist:** greeting is personal + localized · today's sessions correct · attention
items link straight into their flow · ≤ 3 quick actions · paints instantly (skeleton, never blank).

**🧪 Human Test Gate:** Owner opens the app cold "in the morning," sees the day + attention, taps an
attention card and lands exactly where the work is.

**PM Checkpoint.**

---

## M6 — Calendar · Ratings & Analytics · Admin
*Goal: round out the secondary surfaces — full schedule, the coach's rating capture **and** the rich analytics profile that consumes it, and member admin.*

### 🛡️ Sweeper
- [ ] Calendar: richer `listEvents(range)` views + recurring/edit on top of M3's create.
- [ ] **`player_ratings` table** + `ratePlayer(playerId, sessionOrDate, metrics)`: the coach's
      logged performance scores. *(This is the data source M6 analytics displays — capture must
      exist before the trend can render.)*
- [ ] `getPlayerAnalytics(id)` aggregations: performance bars (from ratings), **6-session rating
      trend** (from ratings), season stats, **attendance ring** (from M3), upcoming events, dues
      status (from M4) — all bounded.
- [ ] Admin: `inviteMember(phone|email, role)`, `assignRole`, `setCategoryVisibility`,
      `removeMember` (**preserves historical records**).

**Interfaces produced:** `listEvents(range)`, `ratePlayer(...)`, `getPlayerAnalytics(id)`,
`inviteMember(...)`, `assignRole(...)`, `setCategoryVisibility(...)`, `removeMember(id)`.

### 🧵 Loom
- [ ] **Calendar tab:** month/week of events, tap an event → its attendance (links to M3).
- [ ] **Rating capture UI (build before the analytics display):** a fast way for the coach to log
      performance for a player (from the player profile or post-session) — chips/sliders, no-think.
- [ ] **Player analytics profile:** performance bars, 6-session trend chart, season stats,
      attendance ring, upcoming team events, dues status — clean, scannable, mono numerics.
- [ ] **Admin:** invite-member **modal**, assign-role **sheet**, remove-member **confirm modal**
      (modals only because these are one-time/destructive). Category-visibility toggles.

### 🧭 Atlas
- [ ] Confirm ratings stay lightweight (not a chore that fights the calm tool). Modals reserved for
      destructive/one-time only. Acceptance.

**Acceptance checklist:** create/see events on the calendar · **coach can log a rating, and it
shows up in that player's trend** · analytics profile renders real data · invite → assign role →
member appears · remove member preserves history.

**🧪 Human Test Gate:** Owner schedules an event, logs a couple of ratings for a player, opens that
player's analytics and sees the trend move, invites a member, assigns a role, removes one (history
intact).

**PM Checkpoint.**

---

## M7 — Parent view (tertiary, built late)
*Goal: a parent signs in and sees ONLY their own child — balance, payment history, recent attendance. Read-only, minimal, no complexity. Built now (not in the foundation) because parent is the lowest-priority user.*

### 🛡️ Sweeper
- [ ] **Parent linking:** `parent_links` (`profile_id` ↔ `player_id`). The owner links a parent to
      a child when inviting them (extends M6 `inviteMember` with an optional `playerId`), so a
      parent account is born already tied to exactly one child.
- [ ] **Parent auth:** same phone-OTP mechanism; on first sign-in the invited parent's profile is
      `role = parent`, already linked.
- [ ] **Parent RLS (added now, in isolation):** a `parent` may **read only** their linked child's
      row in `players`, `attendance`, `dues`, `payments` — and nothing else, nowhere writable.
      Because the core policies were built coach/owner-only, this is an additive, auditable layer.

**Interfaces produced:** `linkParent(profileId, playerId)`, `getChildSummary()` (parent-scoped) →
`{ balance, payments[], recentAttendance[] }`.

### 🧵 Loom
- [ ] **Parent home (read-only):** child name + status, **balance** (money semantics), **payment
      history**, **recent attendance**. No edit affordances anywhere. No 5-tab admin shell — a
      pared-down view appropriate to a read-only user.

### 🧭 Atlas
- [ ] Confirm the parent scope is exactly balance + payment history + recent attendance — no more
      (anti-feature: no chat, no edit). Confirm "no login complexity": OTP in, straight to the
      child. Acceptance.

**Acceptance checklist:** an invited+linked parent signs in → sees only their child · cannot see
any other player or any admin surface (RLS verified by **an automated parent-scope test**) · zero
edit controls · clean money + attendance semantics.

**🧪 Human Test Gate:** Owner invites a parent linked to one child; that parent signs in and sees
only that child's balance/payments/attendance — and can reach nothing else.

**PM Checkpoint.**

---

## M8 — Polish · offline hardening · a11y · PWA · metrics · production SMS
*Goal: make it feel finished and trustworthy — installable, fully offline-capable, accessible, instrumented, and sending real OTPs in production.*

### 🛡️ Sweeper
- [ ] PWA: manifest + service worker (offline shell, cache strategy), install support. Verify
      attendance + money offline queues survive reload and bad networks.
- [ ] Settings persistence with **correct defaults** (default language, default dues amount,
      reminder cadence placeholder). *(Drop the "parent notifications" toggle unless a real
      notification channel exists — an inert setting is worse than none.)*
- [ ] **Wire the production SMS provider** for Supabase phone auth; keep the fixed test OTP for
      non-prod. Confirm the persistence settings keep real SMS spend minimal.
- [ ] Instrument the **North Star** (attendance-within-24h) + supporting metrics events
      (time-to-attendance, dues-by-due-date, recovery time, D30, payment taps).

### 🧵 Loom
- [ ] Motion pass: spinning ball + rolling pitch-lines (loading), breathing crest, animated
      success check, bobbing-ball empty states — **all gated by `prefers-reduced-motion`.**
- [ ] **WCAG AA contrast** pass on every screen; sunlight + one-handed pass; ≥ 44px everywhere
      (attendance larger). Install prompt UI.

### 🧭 Atlas
- [ ] Final **six-filter no-think audit** across all flows. Confirm metrics fire. Sign off the
      supporting-metric targets (attendance ≤ 60s, dues ≥ 85% by due date, taps = 2, D30 ≥ 80%).

**Acceptance checklist:** installs as a PWA · full run works offline then syncs · AA contrast holds ·
reduced-motion respected · North Star + supporting metrics emit events · production OTP sends.

**🧪 Human Test Gate:** Owner installs it to the home screen, runs a whole pitch-side day on airplane
mode, reconnects → everything syncs; receives a real OTP on a real phone; the app feels finished.

**Final PM Checkpoint:** Atlas runs the full acceptance suite end-to-end and declares v1.

---

## 6. Definition of done (whole product)

v1 ships when: every milestone gate is passed by the owner · the North Star is instrumented and
trending toward ≥ 95% · attendance for 22 players is reliably ≤ 60s · the 2-tap payment holds · the
Bogrim/kid money invariants are **DB-enforced and covered by a passing test** · monthly dues/
salaries are generatable · the parent sees only their own child (test-verified) · AR/HE parity +
RTL + AA hold on phone and desktop · the app is offline-capable and installable. **No anti-feature
has crept in.**

---

## 7. Notes for whoever picks this up

- Build **in order**. The basics (M0–M1) are the ground; do not start features on an unstable shell
  or before persistent auth works.
- The owner **personally tests each milestone** before the next begins — design every gate to be
  tried by a non-technical person in a few minutes.
- **Atlas can amend** any upcoming task when a gate reveals the no-think bar isn't met; append a
  dated `> PM AMENDMENT:` to the task and notify the owning agent.
- When unsure between two builds, pick the one that **removes a decision from the coach.**
- Remember the on-ramp rule (§4): never gate-test a screen against data that has no way to be
  created in the same milestone.

---

## 8. Changelog

- **Rev 1 (Cue):** Fixed seven sequencing/priority holes found in review —
  (1) parent deferred out of the M2 foundation into its own late milestone **M7** (only the role
  enum slot stays in M1), matching its tertiary priority;
  (2) **event creation** moved up into **M3** so attendance/Home have events to attach to;
  (3) **first-owner bootstrap** added to M1;
  (4) **monthly dues/salary generation** added to M4;
  (5) **coach rating capture** added to M6 ahead of the analytics display;
  (6) an **automated money-invariant test** required in M4 (plus offline-dedup test in M3 and
  parent-scope test in M7);
  (7) M2 RLS stripped to coach/owner only.
  Also added: versioned migrations + Vercel + production-SMS wiring, and dropped the inert
  parent-notifications setting.
