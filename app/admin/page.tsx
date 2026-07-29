import { AdminDashboard } from "@/app/admin/admin-dashboard";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Administration | Fantasy SV" };

export default function AdminPage() {
  return <AdminDashboard />;
}
