"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import {
  createPlayer,
  updatePlayer,
  type Player,
} from "@/lib/players/actions";
import { BottomSheet, useReducedMotion } from "@/components/motion/primitives";
import { SuccessCheck } from "@/components/motion/success-check";

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
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const doneTimer = useRef<number | undefined>(undefined);

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
      setError(t("invalid_input"));
      return;
    }
    const fields = {
      full_name,
      national_id: String(fd.get("national_id") ?? "").trim() || null,
      birthdate: String(fd.get("birthdate") ?? "").trim() || null,
      jersey_number: toNumOrNull(String(fd.get("jersey_number") ?? "")),
      position: String(fd.get("position") ?? "").trim() || null,
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
        className="mx-auto max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-[26px] bg-white px-6 pb-7 pt-2.5"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#D5DEE8]" />

        {saved ? (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col items-center justify-center gap-3.5 px-6 py-12 text-center"
          >
            <SuccessCheck size={64} />
            <p className="text-base font-bold text-[#0B1A2E]">
              {isEdit ? t("saved_updated") : t("saved_added")}
            </p>
          </div>
        ) : (
          <>
        <h2 className="mb-5 text-[17px] font-bold text-[#0B1A2E]">{title}</h2>

        <form onSubmit={submit} noValidate className="flex flex-col gap-3.5">
          <Field
            name="full_name"
            label={t("form_name_label")}
            placeholder={t("form_name_placeholder")}
            defaultValue={player?.full_name}
            required
          />
          <div className="grid grid-cols-2 gap-3.5">
            <Field
              name="position"
              label={t("position")}
              placeholder={t("form_position_placeholder")}
              defaultValue={player?.position ?? undefined}
            />
            <Field
              name="jersey_number"
              label={t("jersey")}
              placeholder={t("form_jersey_placeholder")}
              defaultValue={player?.jersey_number?.toString()}
              inputMode="numeric"
              mono
            />
          </div>
          <div className="grid grid-cols-2 gap-3.5">
            <Field
              name="height_cm"
              label={t("height")}
              placeholder={t("form_height_placeholder")}
              defaultValue={player?.height_cm?.toString()}
              inputMode="numeric"
              mono
            />
            <Field
              name="birthdate"
              label={t("birthdate")}
              type="date"
              defaultValue={player?.birthdate ?? undefined}
              mono
            />
          </div>
          <Field
            name="national_id"
            label={t("national_id")}
            defaultValue={player?.national_id ?? undefined}
            mono
          />
          <Field
            name="guardian_phone"
            label={t("guardian_phone")}
            placeholder={t("form_guardian_phone_placeholder")}
            defaultValue={player?.guardian_phone ?? undefined}
            inputMode="tel"
            mono
          />

          {error && (
            <div role="alert" className="text-[13px] font-semibold text-[#C0392B]">
              {error}
            </div>
          )}

          <div className="mt-1 flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="flex-1 rounded-xl border border-[#DCE6F0] bg-white py-3.5 text-sm font-bold text-[#0B1A2E]"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-xl py-3.5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(4,120,87,0.28)] disabled:opacity-70"
              style={{ background: "var(--color-action-fill)" }}
            >
              {pending ? t("saving") : isEdit ? t("save") : t("add_player")}
            </button>
          </div>
        </form>
          </>
        )}
      </div>
    </BottomSheet>
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
}: {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
  inputMode?: "numeric" | "tel";
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-[#51637A]">
        {label}
        {required && <span className="text-[var(--color-chrome)]"> *</span>}
      </span>
      <input
        name={name}
        type={type}
        inputMode={inputMode}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        dir={mono ? "ltr" : undefined}
        className={`w-full rounded-xl border-[1.5px] border-[#DCE6F0] bg-[#F4F7FB] px-3.5 py-3 text-[15px] text-[#0B1A2E] outline-none placeholder:text-[#94A3B8] focus:border-[var(--color-chrome)] ${
          mono ? "num text-start" : ""
        }`}
      />
    </label>
  );
}
