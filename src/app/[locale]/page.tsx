import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function LocaleHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await auth();
  redirect(session?.user?.active ? `/${locale}/dashboard` : `/${locale}/login`);
}
