"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AccountControls } from "@/app/account-controls";
import { normalizeDatapackMode, type DatapackMode } from "@/lib/datapack";
import { useI18n } from "@/lib/i18n";

const DATAPACK_STORAGE_KEY = "fantasy-sv:datapack-mode";

export function FeatureHeader({
  datapackMode: controlledDatapackMode,
  onDatapackModeChange,
}: {
  datapackMode?: DatapackMode;
  onDatapackModeChange?: (mode: DatapackMode) => void;
} = {}) {
  const { t } = useI18n();
  const [localDatapackMode, setLocalDatapackMode] = useState<DatapackMode>("community");

  useEffect(() => {
    if (controlledDatapackMode) return;
    queueMicrotask(() => {
      setLocalDatapackMode(normalizeDatapackMode(window.localStorage.getItem(DATAPACK_STORAGE_KEY)));
    });
  }, [controlledDatapackMode]);

  const updateDatapackMode = useCallback((mode: DatapackMode) => {
    window.localStorage.setItem(DATAPACK_STORAGE_KEY, mode);
    if (onDatapackModeChange) onDatapackModeChange(mode);
    else setLocalDatapackMode(mode);
  }, [onDatapackModeChange]);

  const datapackMode = controlledDatapackMode || localDatapackMode;

  return (
    <header className="site-header">
      <Link className="brand logo-brand" href="/" aria-label={t("Fantasy SV home")}>
        <Image className="brand-logo" src="/fantasy-sv-logo.png" alt="Fantasy SV" width={384} height={160} priority />
      </Link>
      <nav aria-label={t("Main navigation")}>
        <Link href="/team">{t("My team")}</Link>
        <Link href="/planner">{t("Planner")}</Link>
        <Link href="/transfers">{t("Transfers")}</Link>
        <Link href="/rankings">{t("Rankings")}</Link>
        <Link href="/leagues">{t("Leagues")}</Link>
        <Link href="/history">{t("History")}</Link>
        <Link href="/help">{t("Help")}</Link>
      </nav>
      <AccountControls datapackMode={datapackMode} onDatapackModeChange={updateDatapackMode} />
    </header>
  );
}
