# Product context — TFC Manager (نادي كرة قدم الطيبة)

> Maintained by the acting PM. Bias of this document: **UX is the top value.** When a
> tradeoff appears between feature completeness and a coach's ability to act without
> thinking, the no-think path wins. Every decision below is defensible against the
> six-filter protocol (JTBD → Frequency → Decision-burden → Defaults → Replacement →
> Krug no-think).

---

## One-liner
TFC Manager is a bilingual (Arabic/Hebrew, RTL-first) mobile + desktop app that lets a
football-club coach run **attendance, player dues, and staff salaries** for an entire
club from one screen — so coaching time is spent coaching, not bookkeeping.

## Primary user
**The coach (heavy user, ~90% of sessions).** Arab-Israeli football coach in Tayibe,
30–55, runs 2–4 training/match sessions per day across age groups. Phone-first, often
one-handed and pitch-side in sunlight. Not an accountant; tolerates zero friction.
He opens the app at the *start of his day* to see what's ahead, and *pitch-side* to take
attendance in under a minute. Speaks Arabic primarily, Hebrew fluently.

**Secondary — the owner/manager.** Runs the club's money and roster; adds/removes staff,
assigns roles, watches the overdue list. Uses desktop more than the coach.

**Tertiary — the parent (read-only).** Sees only their child's status: balance, payment
history, recent attendance. No edit power. No login complexity.

## Top 3 jobs-to-be-done (in user voice)
1. "When I arrive in the morning, I want to see my whole day and what needs my attention,
   so I can start coaching without digging through anything."
2. "When a session starts, I want to mark every player present / late / absent in under a
   minute, so attendance never eats into training time."
3. "When a parent pays me cash at the pitch, I want to log it in two taps, so the money is
   recorded before the next drill starts."

Owner JTBD: "When dues go unpaid, I want to see exactly who's overdue and how much, so I
can chase it without building a spreadsheet."

## Player categories (domain model — get this right)
- **بيت سيفر (Beet Sefer)** — football *school*; kids learning to play. **Pays** monthly dues.
- **ليجا (League)** — competitive kids who can play. **Pays** monthly dues.
- **بوجريم (Bogrim)** — adults; the club's senior team. **The club pays them** (salaries, not dues).

This split is load-bearing: a Bogrim player must never appear in the dues ledger, and a
Beet Sefer/League player must never appear in salaries. The money direction is reversed
between them.

## Current core flows
1. **Morning open** (Home): greeting + today's sessions + "needs attention" (overdue dues,
   unsynced attendance) → one tap into any of them.
2. **Take attendance** (Event → roster): per player, three big targets — present / late /
   absent. Late or absent auto-prompts a *reason* (minutes + cause chips). Live progress
   ring. Save → animated success with present/late/absent breakdown.
3. **Record payment** (bottom sheet): pick player → amount (remaining pre-filled) →
   method (cash default) → confirm. Two-tap happy path.
4. **Manage members** (Admin): invite by phone/email → pick role → toggle category
   visibility → optional extra permissions. Edit or remove anytime; removal preserves the
   member's historical records.
5. **Player profile — the kid's pride page** (the one gamified surface, see scoped reversal in
   Anti-features): identity (age, ID, jersey, position, height, guardian) + the kid's OWN
   merits — goals, assists, coach-logged merits, attendance, 6-session rating trend, season
   stats — rendered beautiful and **Instagram-shareable**. Hero shows the few star numbers;
   "full stats" expands the rest. Own achievements only, never a rank vs teammates. (Coach
   reads the same data as analytics; the kid reads it as pride.)

## Current IA (information architecture)
- **Primary tabs (5, mobile bottom nav):** Home · Players · Calendar · Money · Admin.
- **Secondary (one level in):** category roster → player profile; event → attendance;
  Money → Dues / Salaries tabs.
- **Tertiary (sheets & modals):** record-payment sheet, attendance-reason sheet, invite-member
  modal, assign-role sheet, remove-confirm.
- **Hidden in settings:** default language, dues amount, reminder cadence, parent
  notifications, firmware/account.
- **Explicitly NOT in IA:** no social feed, no chat/messaging, no league-table/standings
  module, no in-app payments processor, no tactics board, no video.

## North Star metric
**% of scheduled sessions that have attendance recorded within 24h.** Target ≥ 95%.
(If attendance is captured reliably, the product's core promise — coaching time protected,
parents informed, dues tied to real participation — all follow.)

## Supporting metrics
- Time-to-complete attendance for a 22-player roster (target ≤ 60s; leading indicator of the no-think goal).
- % dues collected by due date (target ≥ 85%).
- Overdue → paid recovery time after first reminder (target ≤ 7 days).
- Coach D30 retention (target ≥ 80%).
- Payment-logging taps on the happy path (target = 2; regression alarm if it climbs).

## Anti-features — things we explicitly will NOT build (with reasons)
- **In-app card/online payment processing** — adds PCI/regulatory burden and a decision
  point ("which method online?"); cash + transfer logging covers the real JTBD today.
- **Chat / messaging between coaches and parents** — invites attention-economy patterns
  and moderation load; the parent read-only view + "contact the coach" line is enough.
- **League standings / fixtures module** — not a JTBD for any of our three users; pure scope creep.
- **Inter-player leaderboards / club-wide ranking of kids** — ranking children against each
  other is the part that risks pressuring kids; we do NOT build it. (See the scoped reversal
  below: a player's *own* pride/stats page IS now in scope — pride, not competition.)

  > **🔓 SCOPED REVERSAL (owner decision, 2026-06-27):** the player-profile page is the ONE
  > deliberately gamified surface. Each player gets a beautiful, Instagram-shareable card of
  > **his own** merits — goals, assists, attendance, coach-logged merits — designed to make the
  > kid proud and enthusiastic. All categories (Beet Sefer / League / Bogrim). The line we keep:
  > it shows a kid HIS OWN achievements, never his rank vs teammates. Recording captures every
  > merit; the hero view shows the few that make him feel like a star, with a "full stats"
  > expand. This is the single intentional exception to the calm-utilitarian rule — the rest of
  > the app (attendance, money, admin) stays calm and ungamified.
- **Free-form per-player custom fields in v1** — every added field is a decision the coach
  must make pitch-side; we ship sensible fixed fields and resist the settings sprawl.
- **A separate "reports/export" tab** — low frequency (<1×/month); lives in settings, not primary IA.
- **Multi-club / federation dashboards** — single-club scope until there's demand; keeps the model simple.

## Brand voice (UX tone)
Warm, confident, sporty, effortless — never corporate, never bureaucratic. The morning
greeting is personal ("صباح الخير، كابتن أمير"). Football motifs (the ball loader, pitch-line
textures, the crest) carry energy without becoming decoration-for-decoration's-sake. Money
states stay strictly clean and unambiguous.

## Visual system (binding)
- **Colors:** Blue `#2563EB` = UI/chrome & navigation. Green `#10B981` = primary *action*
  (confirm, present, save). White `#FFFFFF` = surface. Ink `#0B1A2E` = text. Light theme only.
- **Money status semantics (reserved, never reused for chrome):** paid = green, partial =
  amber `#F59E0B`/`#B45309`, overdue = red `#C0392B`, upcoming = blue.
- **Attendance semantics:** present = green, late = amber, absent = red — same everywhere.
- **Type:** IBM Plex Sans Arabic / Hebrew; IBM Plex Mono for all money & numeric values
  (tabular, LTR-isolated inside RTL).
- **Motion with meaning:** spinning ball + rolling pitch-lines for loading; breathing crest;
  animated success check; bobbing-ball empty states. All respect `prefers-reduced-motion`.

## Platform
Cross-platform, **mobile-first** (coach is phone-first, pitch-side). Desktop companion for
owner/manager money + member admin. Both surfaces designed in parallel.

## Hard constraints
- **Language:** Arabic (primary default) + Hebrew, full parity, RTL-first throughout. Numerals
  and currency render LTR inside RTL.
- **Accessibility floor:** WCAG AA. Touch targets ≥ 44px (attendance buttons are larger).
- **One-handed, sunlight-readable:** primary actions reachable by thumb; high-contrast light theme.
- **Offline:** attendance capture must work without network and sync later (Home surfaces
  "unsynced attendance" as a needs-attention item). Money logging may queue offline.
- **Performance:** instant-paint loading states (skeletons + themed loaders), no blank screens.

---

## UX principles this product is held to (the bar)
- **Krug no-think:** a coach with zero training discovers and completes attendance within
  30 seconds of needing it. If a flow fails this, it gets redesigned, not documented.
- **Defaults over settings:** dues amount, payment method (cash), reminder cadence, language
  all ship with a correct default; overrides are hidden. We do not ask the coach to choose
  what we can choose for him.
- **Decisions removed, not added:** every screen is measured by how few choices it forces.
  The record-payment sheet pre-fills the remaining balance precisely so the common case is zero typing.
- **≤ 5 primary actions per screen** (Hick's Law). Home's "quick actions" are capped at three.
- **Modals only for destructive/one-time decisions** (remove member, confirm). Routine actions
  use inline controls or bottom sheets.
- **Status is never ambiguous:** color + label + (where it matters) icon, so meaning survives
  color-blindness and sunlight.
