"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import {
  createPlayer,
  updatePlayer,
  type Category,
  type Player,
} from "@/lib/players/actions";

// Parse a numeric text field safely: empty → null, non-numeric → null.
// (Number('') is 0 and Number('x') is NaN — both would corrupt the row.)
function toNumOrNull(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Add (player undefined) or edit (player given, fields pre-filled) a player.
export function PlayerFormSheet({
  category,
  player,
  onClose,
  onSaved,
}: {
  category: Category;
  player?: Player;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("players");
  const isEdit = !!player;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const title = isEdit
    ? t("form_edit_title")
    : t("form_add_title", { category: t(`category_${category}`) });

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
      guardian_name: String(fd.get("guardian_name") ?? "").trim() || null,
      guardian_phone: String(fd.get("guardian_phone") ?? "").trim() || null,
    };

    startTransition(async () => {
      const res = isEdit
        ? await updatePlayer(player.id, fields)
        : await createPlayer({ category, ...fields });
      if (!res.ok) {
        setError(t(res.error));
        return;
      }
      onSaved();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label={t("cancel")}
        onClick={onClose}
        className="absolute inset-0 bg-[#0B1A2E]/45"
      />
      <div
        dir="rtl"
        className="relative mx-auto max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-[26px] bg-white px-6 pb-7 pt-2.5"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#D5DEE8]" />
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
            name="guardian_name"
            label={t("guardian")}
            placeholder={t("form_guardian_placeholder")}
            defaultValue={player?.guardian_name ?? undefined}
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
      </div>
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
