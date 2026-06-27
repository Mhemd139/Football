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
Weaves intent into interface. Owns: the design system (tokens, type scale), every screen and
component, RTL layout, shadcn/ui composition, and the **still structure** of loading/empty/success
states. Builds the no-think surface the coach touches pitch-side. **Hands the finished structure to
Pitch for motion + the accessibility pass.**

### 🎬 Pitch — Motion & Polish / Accessibility Engineer
Named for the pitch-lines and the field where it all has to feel alive and read in sunlight. Owns:
the **motion system** (themed loaders — spinning ball, rolling pitch-lines; breathing crest;
animated success checks; bobbing-ball empty states), all transitions and micro-interactions,
`prefers-reduced-motion`, and the **accessibility verification pass** (WCAG AA contrast, ≥ 44px
targets, one-handed reach, sunlight readability). **Does not invent the design system or build
screen logic — that's Loom.** Pitch takes Loom's shipped structure and makes it feel finished and
provably accessible.
- **Equipped skill:** invoke **`web-animation-design`** before any motion work.
- **Level:** senior interaction/motion engineer. Bar = *motion with meaning* — if an animation
  doesn't communicate state or guide attention, it doesn't ship. 60fps, GPU-friendly,
  reduced-motion-safe; WCAG AA is non-negotiable.

### 🧭 Atlas — Product Manager & UX
Holds the map. Owns: scope, priority, the JTBD, acceptance criteria, copy (AR/HE), defaults,
and the right to **amend tasks for Sweeper or Loom** when a deliverable misses the no-think bar
or drifts from the product. Atlas runs the six-filter on every proposed change
(JTBD → Frequency → Decision-burden → Defaults → Replacement → Krug no-think) and writes the
acceptance checklist each milestone is graded against. **Atlas has final say on product
decisions; Sweeper has final say on data integrity; Loom has final say on interaction feel —
conflicts escalate to Atlas.**

### Collaboration protocol
- **Handoff direction per milestone:** Sweeper lands the data + contracts → Loom builds the screen
  structure on the real contracts → **Pitch layers motion + runs the accessibility pass** → Atlas
  runs the acceptance checklist → Human Test Gate.
- **Amendments:** If Atlas changes a requirement mid-milestone, Atlas appends a dated
  `> PM AMENDMENT:` line to the affected task and notifies the owning agent. The agent reworks
  only that task; gates already passed are not reopened unless the amendment touches them.
- **Contracts are shared truth:** every server action / table / type Sweeper produces is listed
  in that milestone's **Interfaces** block. Loom consumes exactly those names — no guessing.
- **Loom vs Pitch (the split):** Loom owns tokens, layout, screen structure/logic, and skeletons
  (the *still frame*). Pitch owns loaders, success/empty animations, all motion + reduced-motion,
  and the WCAG AA / sunlight / one-handed audit (the *living, accessible frame*). **Any animation,
  loader, motion, or accessibility task in any milestone is Pitch's — even where it's printed
  under Loom.**

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
- **Players & teams:** **`category → team → player`.** A `teams` table carries the
  `category` enum (`beet_sefer | league | bogrim`); each team has a **free-text name** typed by the
  coach (no imposed age scheme). A player links to **exactly one team** via `players.team_id`;
  **category is derived through the team**, not stored on the player. The category still drives
  **money direction only** — Bogrim teams are salaried (club pays them, never in dues); Beet
  Sefer / League teams pay dues. **The team is the working unit:** events, attendance, and dues
  hang off `team_id`. The dues-vs-salary invariant is unchanged — it now resolves `player → team
  → category`.
  > PM AMENDMENT 2026-06-20 (Atlas, owner-directed): original spec said "ONE `players` table,
  > `category` enum on the player." Owner corrected the domain — categories contain teams, teams
  > contain players. Category moved to `teams.category`; `players.category` dropped; `players.team_id`
  > added. Invariant preserved. Lands as M3-prep (see M2/M3); M2 screens gain one nav level, not a rewrite.
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
- [ ] Build the shared **loading skeleton** and the **static shells** for empty states (the still
      structure). *(The themed loader, the empty-state animation, and `prefers-reduced-motion` are
      Pitch's — see below.)*
- [ ] RTL layout primitives: a `<Money>` component that renders Plex Mono, tabular, LTR-isolated.

**Interfaces produced:** `<AppShell>`, `<TabBar>`, `<Skeleton>`, `<EmptyState>` (static shell),
`<Money value=… />`.

### 🎬 Pitch
- [ ] Invoke `web-animation-design`. Build the **themed loader** `<BallLoader>` (spinning ball /
      rolling pitch-lines) and the **empty-state motion** (bobbing ball) layered on Loom's
      `<EmptyState>` shell.
- [ ] Establish the **motion baseline** every later animation inherits: standard easing/durations
      as tokens, and one global `prefers-reduced-motion` strategy.

**Interfaces produced:** `<BallLoader>`, the motion tokens, the reduced-motion wrapper.

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

> PM AMENDMENT 2026-06-20 (Atlas, owner-directed; ultracode-verified): M2's flat `category`-on-player model
> is superseded by `category → team → player` (see §2). The gate-passed M2 **UX behavior** is NOT reopened,
> but the engineering blast radius is real and should not be undersold: **one new screen (teams-list) +
> roster/profile/add-sheet relocated one level deeper + every players action re-signatured**
> (`listPlayers(teamId)` not `category`, create/update take `team_id`, flat `playerCounts` gone). IA becomes
> **category → teams-list → team roster → player profile**. The model migration (new `teams` table,
> `players.team_id`, backfill, drop `players.category`) lands as **M3-prep, before M3 starts**. New contracts:
> `listTeams(category)`, `createTeam(category, name)`, team-scoped `listPlayers(teamId)`. Add-player gains
> `team_id` (fixed by route — no double-pick). Money invariant resolves `player → team → category` via TRIGGER
> (see M4 amendment), money stays player-keyed.
> **Decision-burden guard (locked):** to honor "decisions removed, not added," when a category has exactly
> **one team the teams-list passes straight through** to that team's roster — the single-team coach never
> sees the intermediate screen and never has to name a team. The level appears only once a 2nd team exists.
> **Re-point guard (locked):** `team_id` is NOT in the generic edit allow-list; moving a player across
> categories is a deliberate, history-aware action, not a routine field edit.

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

> PM AMENDMENT 2026-06-20 (Atlas, owner-directed): **the team is the working unit.** Events attach to
> `team_id` (NOT category); `getEventRoster` returns that team's players. Prerequisite: the M2-model
> teams migration must be landed first (see M2 amendment). Salaries/dues still resolve via the team's category.

### 🛡️ Sweeper
- [ ] `events` table: `id`, **`team_id` → `teams.id`** (the working unit, not category), `title`, `starts_at`, `location`, `type`
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

> PM AMENDMENT 2026-06-20 (Atlas, ultracode-verified): the teams-layer change (§2) means category is no
> longer a column on the player — it's two FK hops away (`money row → players.team_id → teams.category`).
> A Postgres row **CHECK cannot cross tables**, so the original `CHECK: player.category = …` is unbuildable.
> **Locked decisions:** (1) money stays **`player_id`-keyed** (a player owns their dues/salary history across
> team moves) — category is derived live via the team; the earlier "dues hang off team_id" phrasing is
> **retracted** (events/attendance hang off team_id; MONEY is player-keyed). (2) The invariant is enforced
> by a **BEFORE INSERT/UPDATE trigger** on `dues` and `salaries` that resolves category through
> `players JOIN teams` and `RAISE`s on mismatch — NOT a CHECK. (3) The cross-category re-point hole is
> closed separately: `team_id` is removed from the generic `updatePlayer` allow-list and "move player to
> another team" becomes a deliberate, category-constrained action that blocks a cross-category move once
> the player has money/attendance history.

### 🛡️ Sweeper
- [ ] `dues` table (beet_sefer + league only): `id`, `player_id`, `period` (month), `amount_due`,
      `due_date`, `status` derived (paid|partial|overdue|upcoming). **UNIQUE(player_id, period)**.
      **Invariant via BEFORE INSERT/UPDATE trigger** (resolves `player → team → teams.category`,
      RAISEs unless category ∈ {beet_sefer, league}) — reject Bogrim. *(Not a CHECK — see amendment.)*
- [ ] `payments` table: `id`, `due_id` (or player+period), `amount`, `method` enum
      `cash|transfer`, `paid_at`, `client_id uuid UNIQUE` (offline-safe), `recorded_by`.
- [ ] `salaries` table (bogrim only): `id`, `player_id`, `period`, `amount`, `status`, `paid_at`.
      **UNIQUE(player_id, period)**. **Invariant via BEFORE INSERT/UPDATE trigger** (resolves
      `player → team → teams.category`, RAISEs unless category = bogrim) — reject kids.
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

## M4.5 — Money completion (transaction ledger + cheque lifecycle + document attach)
*Goal: the owner can see and search every payment logged, record a cheque and mark it bounced (which reopens the dues balance), and attach a scan/photo to a transaction — closing the gap between the lean cash/transfer model and how the club actually handles money.*

> PM AMENDMENT 2026-06-27 (Atlas, owner-directed): M4 shipped the contracted money model (cash|transfer
> logging + balances + overdue) and is complete *as contracted*. But the owner confirmed the club runs on
> **cheques that bounce**, and needs a **coach/owner transaction ledger** (M4 gave payment history only to
> the *parent*, never the coach). Neither cheques, bounce status, nor document attachment existed anywhere
> in the original plan — the plan **under-scoped money**. This milestone closes that. **Locked decisions:**
> (1) money stays `player_id`/`due_id`-keyed (unchanged). (2) The three pieces are **dependency-ordered** —
> ledger first (it's the surface the other two hang off), then cheque lifecycle, then document attach.
> (3) A bounced cheque is NOT a deletion: the payment row persists with `status=bounced` and the linked
> due **reopens** (balance recomputes to overdue/partial) — derived at read-time, never stored, same as
> every money status. (4) Sequenced **after M4's Human Test Gate, before M5** — Home surfaces money and
> should sit on the complete model. (5) **The cheque number is the primary reconciliation key.** When a
> cheque bounces, the bank returns it with only a *number* — no name. So `cheque_number` is **required**
> when method = cheque, indexed, and searchable; the owner recovers *who gave the cheque* by punching that
> number into the ledger. Search-by-player is the secondary path; search-by-cheque-number is the one the
> bounce workflow actually depends on.

### 🛡️ Sweeper
- [ ] **`listPayments({ period?, playerId?, chequeNumber? })`** — bounded, ordered transaction list
      (who, amount, method, status, cheque #, when). Reads existing `payments` data; no new storage.
      `chequeNumber` matches exactly (the bounce-lookup path, below). This is the ledger's source.
- [ ] **Cheque method + number + status:** add `cheque` to the `method` enum; add a `cheque_number`
      column (text, **required when method = cheque**, indexed — it's the search key, see amendment);
      add a payment `status` `pending | cleared | bounced` (the current model has no payment status).
      Cash/transfer default to `cleared` and carry no cheque number; a cheque starts `pending`.
- [ ] **`findPaymentByChequeNumber(chequeNumber)`** — resolves a (bounced) cheque number back to its
      payment → player → due. This is the PRIMARY way a bounce is reconciled: the bank returns a cheque
      with only a number on it, and the owner must recover *who gave it* from that number alone.
- [ ] **Bounce lifecycle:** `markChequeBounced(paymentId)` sets `status=bounced`; the linked due's
      balance **reopens** — `remaining`/`status` recompute as if the payment never cleared, but the
      bounced payment row **stays visible** (the owner must see whose cheque bounced, to chase it).
      Derived at read-time (no stored balance to drift). **Highest-consequence logic in this milestone —
      a silent bug = "paid" hiding a bounce = lost money. Strong ultracode candidate.**
- [ ] **Document storage:** a Supabase Storage bucket for transaction attachments, **RLS owner/coach
      only — never parent** (financial docs, privacy-first default-deny). `attachDocument(paymentId, file)`
      + the read path for viewing it. Optional per payment (cash needs none; a cheque should have one).
- [ ] **Tests:** cheque number is required for cheque method + resolves back to the right player;
      bounce reopens the due (balance flips back, payment stays visible); ledger query is
      bounded + RLS-scoped; storage RLS denies parent.

**Interfaces produced:** `listPayments(filter)`, `findPaymentByChequeNumber(chequeNumber)`,
`markChequeBounced(paymentId)`, `attachDocument(paymentId, file)` + document read path. `recordPayment`
extended for `cheque` method (carries the required cheque number).

### 🧵 Loom
- [ ] **Transaction ledger view** (coach/owner) — searchable by **cheque number** (primary) and
      filterable by player + period; each row shows amount, method, status (color + label), cheque #
      (for cheques), date, and a doc indicator if attached.
- [ ] **Cheque flow:** record-payment sheet gains `cheque` as a method **with a required cheque-number
      field**; a cheque row in the ledger offers **"mark bounced"** → confirms → the linked due visibly
      reopens. **Bounce-reconciliation path:** owner types the bounced cheque's number into search → the
      single matching payment surfaces, showing the player who gave it → mark bounced from there.
- [ ] **Document attach:** capture/upload a photo or file against a payment (camera + file picker);
      view the attached image from the ledger row. Optional, never required.
- [ ] Bounced status uses a distinct, unambiguous treatment (NOT reused with overdue-red alone —
      color + label, "ارتد / bounced") so a bounced cheque never reads as a normal unpaid row.

### 🧭 Atlas
- [ ] **Scope guard:** the ledger is a *view*, not a second place to edit money — recording still happens
      via the 2-tap sheet (don't split the payment-entry path). Bounce + attach are the only new write
      actions. Confirm money states stay unambiguous (product-context:104) once `bounced` + `cheque` join
      the status set. **Cheque number renders mono + LTR** (it's a numeral, same rule as money). AR/HE
      copy for the new keys (`method_cheque`, `cheque_number`, `status_pending/cleared/bounced`, ledger
      labels). Acceptance.

**Acceptance checklist:** owner opens a list of every payment searchable **by cheque number** ·
records a cheque (requires a cheque number, starts pending) · **types a bounced cheque's number → the
payment + the player who gave it surface** · marks it bounced → the player's due **reopens** (balance
climbs back, status returns to overdue/partial) and the bounced cheque stays visible · attaches a photo
to a transaction and views it · parent **cannot** reach the ledger or the documents · numerals + cheque #
mono + LTR; statuses color + label.

**🧪 Human Test Gate:** Owner logs a cheque (entering its number), then — simulating a bank rejection —
**searches the ledger by that cheque number alone, with no idea whose it is, and the app surfaces the
player who gave it**; marks it bounced, confirms the balance reopened and the bounced cheque is still
listed with the player's name; attaches a cheque photo and reopens it. Sweeper shows the
cheque-number-resolves-to-player test + the bounce-reopens-due test + the parent-denied storage RLS test passing.

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
- [ ] Admin: `setCategoryVisibility`, `removeMember` (**preserves historical records**).
      *(Member PROVISIONING — who may sign in and as what — moved to M6.5; it's an auth invariant,
      not a settings convenience. M6 Admin keeps only the post-provisioning controls.)*

**Interfaces produced:** `listEvents(range)`, `ratePlayer(...)`, `getPlayerAnalytics(id)`,
`setCategoryVisibility(...)`, `removeMember(id)`.

### 🧵 Loom
- [ ] **Calendar tab:** month/week of events, tap an event → its attendance (links to M3).
- [ ] **Rating capture UI (build before the analytics display):** a fast way for the coach to log
      performance for a player (from the player profile or post-session) — chips/sliders, no-think.
- [ ] **Player analytics profile:** performance bars, 6-session trend chart, season stats,
      attendance ring, upcoming team events, dues status — clean, scannable, mono numerics.
- [ ] **Admin:** category-visibility toggles + remove-member **confirm modal** (destructive).
      *(Add-member / assign-role UI lives in M6.5.)*

### 🧭 Atlas
- [ ] Confirm ratings stay lightweight (not a chore that fights the calm tool). Modals reserved for
      destructive/one-time only. Acceptance.

**Acceptance checklist:** create/see events on the calendar · **coach can log a rating, and it
shows up in that player's trend** · analytics profile renders real data · remove member preserves
history · category visibility toggles work.

**🧪 Human Test Gate:** Owner schedules an event, logs a couple of ratings for a player, opens that
player's analytics and sees the trend move, removes a member (history intact), toggles a coach's
category visibility.

**PM Checkpoint.**

---

## M6.5 — Member provisioning & access control (the owner is the gate)
*Goal: NObody reaches the app without the owner first adding their phone and choosing their role. Authority is granted by the owner, never claimed by signing in. This is the security spine the whole multi-user model — and the M7 parent view — stands on.*

> PM AMENDMENT 2026-06-28 (Atlas, owner-directed): the plan assumed `inviteMember` handled enrollment,
> but the shipped auth does the OPPOSITE — `profiles.role` defaults to **`coach`** (`0001`:7) and
> `set_first_owner` only special-cases the FIRST phone, so **every phone after the first is born a full
> coach** with no owner approval (open-enrollment by arrival order). That's a club-data breach the moment
> the app is reachable outside the owner's circle. **Owner ruling: only owner-provisioned phones may sign
> in, with the role the owner set.** This pulls member-provisioning out of M6's grab-bag into its own
> milestone because it is an **auth invariant**, not a settings screen, and M7 (parent) depends on it.
>
> **OWNER UPDATE 2026-06-28: the first owner is SEEDED in a migration, not hand-edited in the DB.** Owner:
> *"Muhammad 0587131002 is the first owner — that way I add whoever I want using the UI instead of
> manually in the DB, which is dumb."* So a one-line migration inserts `+972587131002` as the single
> owner allow-list entry; it runs automatically on deploy, the owner never touches the DB, signs in by
> OTP and lands as owner, then provisions everyone else in-app. This keeps the rule absolute: **no account
> is EVER born with a role by arriving — the first owner is a pre-seeded allow-list row (in code, written
> once), every account after is provisioned by the owner through the UI.** `set_first_owner` is therefore
> **deleted, not kept** (auto-owner-by-first-arrival is the same arrival-order bug as the coach default;
> seeding the known owner phone closes it for good — no stranger can claim owner by signing in first).
>
> **Locked decisions:** (1) **No auto-role bootstrap.** Drop the `set_first_owner` trigger; the first
> owner is a **seeded allow-list row** (`+972587131002`, role `owner`) in a migration — not hand-edited,
> not arrival-based. (2) Every phone must be on the **owner-written allow-list** (phone + role) BEFORE
> sign-in; an un-listed phone gets **no OTP success, no profile, no role**. (3) The `role default 'coach'`
> is removed — a profile's role comes from its allow-list entry, never a column default; a
> roleless/defaulted profile is impossible. (4) The allow-list write is **owner-only**, server-enforced
> (`current_role() = 'owner'`). (5) Sequenced **before M7** — a parent is just an owner-provisioned phone
> with `role=parent`; the parent view can't be safe until this lands.

### 🛡️ Sweeper
- [ ] **Allow-list table** (`provisioned_members` or similar): `phone`, `role` (`coach|owner|parent`),
      optional `full_name`, optional `player_id` (for parent→child linking, feeds M7), `created_by`
      (the owner), `claimed_at` (null until that phone first signs in). **Owner-only RLS** — only
      `current_role() = 'owner'` may read/write it.
- [ ] **Gate sign-in on the allow-list:** rework `handle_new_user` (`0003`) so a profile is created
      **only** for a phone present in the allow-list, stamped with **that entry's role** (not a default).
      An un-provisioned phone → **no profile, sign-in fails closed.** No bootstrap exception — the first
      owner is provisioned by hand (see below), so the allow-list is the single gate for everyone.
- [ ] **Drop `set_first_owner`** (`0001`:20 trigger) — auto-owner-by-first-arrival is the same
      arrival-order hole as the coach default. The first owner is set MANUALLY by the human owner
      (DB/console); no code path assigns owner automatically. *(The `profiles_one_owner` partial unique
      index stays — it still guarantees at most one owner.)*
- [ ] **Remove the `role` column default** (`0001`:7 `default 'coach'`) — role is always set explicitly
      from the allow-list at creation or by the owner via `assignRole`; a roleless/defaulted profile must
      be impossible.
- [ ] **Owner provisioning actions:** `addMember({ phone, role, fullName?, playerId? })`,
      `assignRole(profileId|phone, role)`, `revokeMember(phone)` — all **owner-only, server-gated**,
      `phone`/`role`/`player_id` never accepted from a non-owner caller (mass-assignment guard).
- [ ] **Design note + migration flag** — this reverses a shipped default and changes enrollment; write
      the design note, flag the migration like every schema change, apply on owner-go. Coordinate with
      Marker (he re-verifies). **Strong ULTRACODE candidate** — auth/authority correctness, the exact
      "silent bug = unauthorized access" trigger.

**Interfaces produced:** `addMember(...)`, `assignRole(...)`, `revokeMember(phone)`,
`listProvisionedMembers()` (owner-scoped). Sign-in path now allow-list-gated.

### 🧵 Loom
- [ ] **"Add member" flow (owner only) — the provisioning surface.** Owner enters a **phone number**
      (the primary key of access; phone-OTP app, NOT email) → picks a **role** (coach / parent / owner)
      → optional name → for a parent, picks the linked child. This IS the allow-list write. A **bottom
      sheet** (routine create), not a modal.
- [ ] **Members list (owner only):** every provisioned phone with its role + a **状态** chip —
      **"بانتظار أول دخول / pending first sign-in"** (allow-listed, never signed in → `claimed_at` null)
      vs **"نشِط / active"** (has signed in). So the owner sees who's been added vs who's actually in.
- [ ] **Assign-role / revoke** from a member row — **assign-role sheet**; **revoke = confirm modal**
      (destructive: it cuts off access). Revoke preserves history (same rule as `removeMember`).
- [ ] **Honest empty/blocked states:** a phone not yet provisioned that tries to sign in sees a calm
      **"تواصل مع إدارة النادي لإضافتك / contact the club to be added"** — never a raw auth error, never
      a silent dead end (no-silent-failure rule).

### 🧭 Atlas
- [ ] **Scope guard:** provisioning is **owner-only** — coaches never see it (it's the authority gate).
      The "add member" path is the ONLY way anyone enters; confirm there is **no self-signup anywhere**
      in the app (no public "create account"). Phone is the access key (no email field — the app is
      phone-OTP). AR/HE copy: `members.add`, `members.role_coach/owner/parent`, `members.pending`,
      `members.active`, `members.revoke_confirm`, the not-provisioned sign-in block message. Acceptance.

**Acceptance checklist:** the first owner (provisioned manually) can sign in and add members · owner
adds a phone + role → that phone (and ONLY that phone) can complete OTP and lands in exactly that role
· a phone the owner did NOT add **cannot sign in** (no profile, no access) · a newly-added member shows
"pending first sign-in" until they sign in, then "active" · owner can change a member's role and revoke
access (history preserved) · **no account is ever auto-assigned a role by arriving** · no self-signup
path exists anywhere.

**🧪 Human Test Gate:** Owner adds a coach's phone → that coach signs in and lands as coach. A phone
NOT added by the owner attempts OTP and **is refused** (sees the "contact the club" message, gets no
account). Owner revokes the coach → that coach can no longer reach club data. Marker shows the
"un-provisioned phone cannot acquire any role" negative test (real wrong-user JWT) passing.

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
- [ ] Install-prompt UI and any final structural / layout cleanup.

### 🎬 Pitch
- [ ] Invoke `web-animation-design`. Final **motion pass**: spinning ball + rolling pitch-lines
      (loading), breathing crest, animated success check, bobbing-ball empty states — **all gated by
      `prefers-reduced-motion`** and running at 60fps.
- [ ] Final **accessibility pass** (gate-blocking sign-off): WCAG AA contrast on every screen,
      sunlight + one-handed check, ≥ 44px everywhere (attendance larger).

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
- **Rev 2 (Cue):** Split Loom — added **🎬 Pitch** (motion + polish + accessibility), equipped with
  the `web-animation-design` skill, so Loom no longer carries motion/a11y across all eight
  milestones alone. Loom ships structure; Pitch layers motion and owns the WCAG AA / sunlight /
  one-handed pass. Division rule in §1; M0 and M8 ownership updated; every motion/a11y task in any
  milestone is Pitch's.
