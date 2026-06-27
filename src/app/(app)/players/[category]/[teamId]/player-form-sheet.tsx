"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  createPlayer,
  updatePlayer,
  type Player,
} from "@/lib/players/actions";
import { POSITIONS, positionMeta, type Position } from "@/lib/players/positions";
import { BottomSheet, motion, useReducedMotion, EASE } from "@/components/motion/primitives";
import { SuccessCheck } from "@/components/motion/success-check";

// Neutral tint when no position is chosen — the app's chrome blue, so the band,
// focus glow, and save fill stay "alive" rather than collapsing to flat grey.
const NEUTRAL_TINT = "#2563EB";

// Parse a numeric text field safely: empty → null, non-numeric → null.
// (Number('') is 0 and Number('x') is NaN — both would corrupt the row.)
function toNumOrNull(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Add (player undefined) or edit (player given, fields pre-filled) a player.
// The team is fixed by the roster you entered from — no second pick.
//
// The whole sheet is themed by the player's EXACT position color: the identity
// band, the active chip, the focus glow, and the save fill all breathe that one
// hue. On edit it opens already wearing the player's color; picking a position
// re-tints it live. No position → the neutral chrome blue.
export function PlayerFormSheet({
  teamId,
  teamName,
  player,
  onClose,
  onSaved,
}: {
  teamId: string;
  teamName: string;
  player?: Player;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("players");
  const reduce = useReducedMotion();
  const isEdit = !!player;
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [position, setPosition] = useState<Position | null>(
    positionMeta(player?.position)?.value ?? null,
  );
  const [pending, startTransition] = useTransition();
  const doneTimer = useRef<number | undefined>(undefined);

  const meta = positionMeta(position);
  const tint = meta?.color ?? NEUTRAL_TINT;

  // Clear the success-beat timer if the sheet unmounts mid-beat.
  useEffect(() => () => window.clearTimeout(doneTimer.current), []);

  // Lock the background page while the sheet is open, so scroll gestures move the
  // sheet's own content, not the roster behind it. (Escape + focus trapping are
  // owned by BottomSheet's focus trap.)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const title = isEdit
    ? t("form_edit_title")
    : t("form_add_to_team", { team: teamName });

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    const full_name = String(fd.get("full_name") ?? "").trim();
    if (!full_name) {
      // Point the coach straight at the field that's missing, not a generic
      // banner at the bottom of the form.
      setNameError(true);
      return;
    }
    const fields = {
      full_name,
      national_id: String(fd.get("national_id") ?? "").trim() || null,
      birthdate: String(fd.get("birthdate") ?? "").trim() || null,
      jersey_number: toNumOrNull(String(fd.get("jersey_number") ?? "")),
      position,
      height_cm: toNumOrNull(String(fd.get("height_cm") ?? "")),
      guardian_phone: String(fd.get("guardian_phone") ?? "").trim() || null,
    };

    startTransition(async () => {
      const res = isEdit
        ? await updatePlayer(player.id, fields)
        : await createPlayer({ team_id: teamId, ...fields });
      if (!res.ok) {
        setError(t(res.error));
        return;
      }
      // Show the success beat, then hand back to the caller (close + refresh).
      // Reduced motion gets a shorter beat — still confirms, doesn't dwell.
      setSaved(true);
      doneTimer.current = window.setTimeout(onSaved, reduce ? 450 : 850);
    });
  }

  return (
    <BottomSheet onClose={onClose} label={title}>
      <div
        dir="rtl"
        className="mx-auto flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] bg-white"
      >
        {saved ? (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col items-center justify-center gap-3.5 px-6 py-16 text-center"
          >
            <SuccessCheck size={64} />
            <p className="text-base font-bold text-[#0B1A2E]">
              {isEdit ? t("saved_updated") : t("saved_added")}
            </p>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
            <IdentityBand
              title={title}
              tint={tint}
              positionLabel={meta ? t(`pos_${meta.value}`) : null}
              reduce={!!reduce}
            />

            {/* Scroll region — only this grows/scrolls; the footer stays put. */}
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-4 pt-4">
              {/* Identity — the two fields that define who this is; no label
                  needed, they're the obvious first thing. */}
              <Field
                name="full_name"
                label={t("form_name_label")}
                placeholder={t("form_name_placeholder")}
                defaultValue={player?.full_name}
                required
                tint={tint}
                invalid={nameError}
                errorText={nameError ? t("name_required") : undefined}
                onInput={() => nameError && setNameError(false)}
              />
              <PositionPicker
                label={t("position")}
                hint={t("position_pick_hint")}
                value={position}
                onChange={setPosition}
                optionLabel={(v) => t(`pos_${v}`)}
              />

              {/* Details — all optional, shown inline under a quiet divider so
                  every field is visible and reachable (no hidden affordance). */}
              <div className="mt-1 flex items-center gap-2.5">
                <span className="h-px flex-1 bg-[#EDF1F6]" />
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#94A3B8]">
                  {t("form_details_label")}
                </span>
                <span className="h-px flex-1 bg-[#EDF1F6]" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field
                  name="jersey_number"
                  label={t("jersey")}
                  placeholder={t("form_jersey_placeholder")}
                  defaultValue={player?.jersey_number?.toString()}
                  inputMode="numeric"
                  tint={tint}
                  mono
                />
                <Field
                  name="height_cm"
                  label={t("height")}
                  placeholder={t("form_height_placeholder")}
                  defaultValue={player?.height_cm?.toString()}
                  inputMode="numeric"
                  tint={tint}
                  mono
                />
              </div>
              <DateField
                label={t("birthdate")}
                defaultValue={player?.birthdate ?? undefined}
                invalidText={t("date_invalid")}
                dayLabel={t("date_day")}
                monthLabel={t("date_month")}
                yearLabel={t("date_year")}
                tint={tint}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  name="national_id"
                  label={t("national_id")}
                  defaultValue={player?.national_id ?? undefined}
                  tint={tint}
                  mono
                />
                <Field
                  name="guardian_phone"
                  label={t("guardian_phone")}
                  placeholder={t("form_guardian_phone_placeholder")}
                  defaultValue={player?.guardian_phone ?? undefined}
                  inputMode="tel"
                  tint={tint}
                  mono
                />
              </div>

              {error && (
                <div role="alert" className="text-[13px] font-semibold text-[#C0392B]">
                  {error}
                </div>
              )}
            </div>

            {/* Footer — always flush at the bottom of the panel, in normal flow
                (not sticky), so a short form has no dead gap above the buttons. */}
            <div className="flex gap-2.5 border-t border-[#EDF1F6] bg-white px-6 pb-7 pt-3.5">
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="flex-1 rounded-2xl border border-[#DCE6F0] bg-white py-3.5 text-sm font-bold text-[#0B1A2E] transition active:scale-[0.98]"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={pending}
                className="flex-[1.6] rounded-2xl py-3.5 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-70"
                style={{
                  background: tint,
                  boxShadow: `0 10px 24px ${tint}40`,
                  transition: "background 0.3s cubic-bezier(0.32,0.72,0,1), box-shadow 0.3s, transform 0.15s",
                }}
              >
                {pending ? t("saving") : isEdit ? t("save") : t("add_player")}
              </button>
            </div>
          </form>
        )}
      </div>
    </BottomSheet>
  );
}

// The identity band — a floodlit gradient header in the player's EXACT position
// color, with the club crest in a glass tile. This is the sheet's one bold
// element: it re-tints live as the position changes, so "edit the striker" wears
// red and "edit the keeper" wears amber. White text is AA on the `--pos` ramp
// (the gradient darkens the base ~20% — same ramp the roster jersey tiles use).
function IdentityBand({
  title,
  tint,
  positionLabel,
  reduce,
}: {
  title: string;
  tint: string;
  positionLabel: string | null;
  reduce: boolean;
}) {
  return (
    <div
      className="floodlit floodlit--pos relative px-6 pb-5 pt-3.5 text-white"
      style={
        {
          "--pos": tint,
          borderRadius: "28px 28px 0 0",
          transition: reduce ? undefined : "background 0.35s cubic-bezier(0.32,0.72,0,1)",
        } as React.CSSProperties
      }
    >
      {/* grabber — on the band, in white so it reads on the tint */}
      <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/45" />
      <div className="flex items-center gap-3.5">
        <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-white/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] ring-1 ring-white/25">
          <Image
            src="/assets/tfc-crest-circle.png"
            alt=""
            width={34}
            height={34}
            className="object-contain"
          />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[17px] font-extrabold leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]">
            {title}
          </h2>
          <motion.p
            key={positionLabel ?? "none"}
            initial={reduce ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="mt-0.5 text-[12px] font-semibold text-white/85"
          >
            {positionLabel ?? "—"}
          </motion.p>
        </div>
      </div>
    </div>
  );
}

// Colored position picker — 7 chips, one tap, color-coded by line. Tapping the
// selected chip again clears it (a player with no fixed position is valid). Each
// chip is its own ≥44px target. The selected chip fills with its position color;
// the rest stay neutral outlines so the choice reads at a glance.
function PositionPicker({
  label,
  hint,
  value,
  onChange,
  optionLabel,
}: {
  label: string;
  hint: string;
  value: Position | null;
  onChange: (v: Position | null) => void;
  optionLabel: (v: Position) => string;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold text-[#51637A]">{label}</span>
      <div role="radiogroup" aria-label={hint} className="flex flex-wrap gap-2">
        {POSITIONS.map(({ value: v, color }) => {
          const on = value === v;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(on ? null : v)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full border-[1.5px] px-3.5 text-[13px] font-bold transition active:scale-95"
              style={
                on
                  ? { borderColor: color, background: `${color}1A`, color }
                  : { borderColor: "#DCE6F0", background: "#fff", color: "#51637A" }
              }
            >
              <span
                className="h-2.5 w-2.5 flex-none rounded-full transition-transform"
                style={{ background: color, opacity: on ? 1 : 0.5, transform: on ? "scale(1.15)" : "scale(1)" }}
                aria-hidden="true"
              />
              {optionLabel(v)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Split a stored YYYY-MM-DD into D/M/Y parts for the segmented editor.
function splitDate(iso?: string): { d: string; m: string; y: string } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!match) return { d: "", m: "", y: "" };
  return { d: String(+match[3]), m: String(+match[2]), y: match[1] };
}

// Assemble D/M/Y into a valid YYYY-MM-DD, or null. Returns null while the date
// is incomplete; returns "invalid" only once all three are filled but don't form
// a real calendar date (e.g. 31/02, year out of 1900..today). Never emits a
// half-formed string — the server writes straight to a Postgres `date` column.
function buildDate(d: string, m: string, y: string): string | null | "invalid" {
  if (!d && !m && !y) return null;
  if (d.length === 0 || m.length === 0 || y.length !== 4) return "invalid";
  const day = +d;
  const month = +m;
  const year = +y;
  const now = new Date();
  if (year < 1900 || year > now.getFullYear()) return "invalid";
  if (month < 1 || month > 12 || day < 1 || day > 31) return "invalid";
  // Round-trip through Date to reject impossible days (Feb 30, Apr 31…).
  const dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
    return "invalid";
  }
  if (dt > now) return "invalid";
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

// Birthdate as three numeric segments — Day / Month / Year — instead of the
// native <input type=date> calendar. A coach recalls a birthdate; they don't
// browse to it, so scrubbing a calendar back to the 1990s is the wrong
// affordance. Segments auto-advance, stay RTL-safe and Western-numeral (`.num`),
// and feed a hidden `birthdate` input that the form reads via FormData. The
// hidden value is only a real YYYY-MM-DD or "" — never a partial string.
function DateField({
  label,
  defaultValue,
  invalidText,
  dayLabel,
  monthLabel,
  yearLabel,
  tint,
}: {
  label: string;
  defaultValue?: string;
  invalidText: string;
  dayLabel: string;
  monthLabel: string;
  yearLabel: string;
  tint: string;
}) {
  const init = splitDate(defaultValue);
  const [d, setD] = useState(init.d);
  const [m, setM] = useState(init.m);
  const [y, setY] = useState(init.y);
  const [focused, setFocused] = useState(false);

  const built = buildDate(d, m, y);
  const isInvalid = built === "invalid";
  const hiddenValue = typeof built === "string" && built !== "invalid" ? built : "";

  // Keep only digits, cap length, and hop to the NEXT sibling segment once full.
  // Walking from the event target (an event-time DOM read) keeps focus handling
  // out of render — no refs threaded through props.
  const onSeg =
    (set: (v: string) => void, max: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value.replace(/\D/g, "").slice(0, max);
      set(v);
      if (v.length === max) {
        const next = e.target.nextElementSibling;
        if (next instanceof HTMLInputElement) next.focus();
      }
    };

  const ring = isInvalid ? "#C0392B" : tint;
  const segClass =
    "num w-full rounded-2xl border-[1.5px] bg-[#F4F7FB] px-2 py-3 text-center text-[15px] text-[#0B1A2E] outline-none transition-[border-color,box-shadow,background] duration-200 placeholder:text-[#94A3B8] focus:bg-white";

  return (
    <div>
      <input type="hidden" name="birthdate" value={hiddenValue} readOnly />
      <span className="mb-1.5 block text-xs font-semibold text-[#51637A]">{label}</span>
      <div
        className="grid grid-cols-[1fr_1fr_1.4fr] gap-2.5"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        dir="ltr"
      >
        {(
          [
            [d, setD, 2, dayLabel],
            [m, setM, 2, monthLabel],
            [y, setY, 4, yearLabel],
          ] as const
        ).map(([val, set, max, lbl], i) => (
          <input
            key={i}
            type="text"
            inputMode="numeric"
            value={val}
            onChange={onSeg(set, max)}
            placeholder={lbl}
            aria-label={lbl}
            aria-invalid={isInvalid || undefined}
            className={segClass}
            style={{
              borderColor: focused || isInvalid ? ring : "#DCE6F0",
              boxShadow: focused ? `0 0 0 4px ${ring}1F` : "none",
            }}
          />
        ))}
      </div>
      {isInvalid && (
        <span role="alert" className="mt-1 block text-[12px] font-semibold text-[#C0392B]">
          {invalidText}
        </span>
      )}
    </div>
  );
}

function Field({
  name,
  label,
  placeholder,
  defaultValue,
  required,
  type = "text",
  inputMode,
  mono,
  tint,
  invalid,
  errorText,
  onInput,
}: {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
  inputMode?: "numeric" | "tel";
  mono?: boolean;
  tint: string;
  invalid?: boolean;
  errorText?: string;
  onInput?: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const ring = invalid ? "#C0392B" : tint;
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-[#51637A]">
        {label}
        {required && <span style={{ color: tint }}> *</span>}
      </span>
      <input
        name={name}
        type={type}
        inputMode={inputMode}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        dir={mono ? "ltr" : undefined}
        aria-invalid={invalid || undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onInput={onInput}
        className={`w-full rounded-2xl border-[1.5px] bg-[#F4F7FB] px-3.5 py-3 text-[15px] text-[#0B1A2E] outline-none transition-[border-color,box-shadow,background] duration-200 placeholder:text-[#94A3B8] focus:bg-white ${
          mono ? "num text-start" : ""
        }`}
        style={{
          borderColor: focused || invalid ? ring : "#DCE6F0",
          boxShadow: focused ? `0 0 0 4px ${ring}1F` : "none",
        }}
      />
      {errorText && (
        <span role="alert" className="mt-1 block text-[12px] font-semibold text-[#C0392B]">
          {errorText}
        </span>
      )}
    </label>
  );
}
