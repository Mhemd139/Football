"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { deactivatePlayer, type Category, type Player } from "@/lib/players/actions";
import { PlayerFormSheet } from "../player-form-sheet";

// Edit + deactivate controls for a player profile. Lives in the hero.
export function ProfileActions({
  category,
  player,
}: {
  category: Category;
  player: Player;
}) {
  const t = useTranslations("players");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-full bg-white/20 px-3.5 py-1.5 text-xs font-bold text-white"
        >
          {t("edit")}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-full bg-white/20 px-3.5 py-1.5 text-xs font-bold text-white"
        >
          {t("deactivate")}
        </button>
      </div>

      {editing && (
        <PlayerFormSheet
          category={category}
          player={player}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      )}

      {confirming && (
        <DeactivateConfirm
          name={player.full_name}
          onClose={() => setConfirming(false)}
          onConfirmed={() => router.replace(`/players/${category}`)}
          id={player.id}
        />
      )}
    </>
  );
}

function DeactivateConfirm({
  id,
  name,
  onClose,
  onConfirmed,
}: {
  id: string;
  name: string;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const t = useTranslations("players");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const res = await deactivatePlayer(id);
      if (!res.ok) {
        setError(t(res.error));
        return;
      }
      onConfirmed();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-label={t("deactivate")}
    >
      <button
        type="button"
        aria-label={t("cancel")}
        onClick={onClose}
        className="absolute inset-0 bg-[#0B1A2E]/45"
      />
      <div dir="rtl" className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[#FDF2F2]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2" aria-hidden="true">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
          </svg>
        </div>
        <h2 className="mb-2 text-lg font-bold text-[#0B1A2E]">
          {t("deactivate_title", { name })}
        </h2>
        <p className="mb-5 text-[13.5px] leading-relaxed text-[#6B7A8D]">
          {t("deactivate_body")}
        </p>
        {error && (
          <div role="alert" className="mb-3 text-[13px] font-semibold text-[#C0392B]">
            {error}
          </div>
        )}
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="flex-1 rounded-xl border border-[#DCE6F0] bg-white py-3 text-sm font-bold text-[#0B1A2E]"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className="flex-1 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-70"
            style={{ background: "#C0392B" }}
          >
            {pending ? t("saving") : t("deactivate_confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
