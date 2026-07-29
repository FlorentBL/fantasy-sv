"use client";

import Image from "next/image";
import Link from "next/link";
import styles from "./feature-pages.module.css";
import { useI18n } from "@/lib/i18n";

export function FeatureHeader() {
  const { t } = useI18n();
  return (
    <header className={styles.header}>
      <Link href="/" aria-label="Fantasy SV"><Image src="/fantasy-sv-logo.png" alt="Fantasy SV" width={384} height={160} /></Link>
      <nav className={styles.nav}>
        <Link href="/team">{t("My team")}</Link>
        <Link href="/planner">{t("Planner")}</Link>
        <Link href="/transfers">{t("Transfers")}</Link>
        <Link href="/history">{t("Manager history")}</Link>
      </nav>
    </header>
  );
}
