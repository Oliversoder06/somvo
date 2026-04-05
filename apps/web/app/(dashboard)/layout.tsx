import { Topbar } from "@/components/topbar";
import { Providers } from "@/components/providers";
import { getAuthenticatedUser } from "@/lib/utils/get-user";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, plan } = await getAuthenticatedUser();

  return (
    <Providers>
      <div
        className="flex flex-col h-screen overflow-hidden"
        style={{ background: "var(--bg-base)", padding: 6, gap: 6 }}
      >
        <Topbar mode="dashboard" email={user?.email ?? null} plan={plan} />
        <main
          className="flex-1 overflow-y-auto"
          id="main-content"
          style={{
            background: "var(--bg-surface)",
            borderRadius: 10,
          }}
        >
          {children}
        </main>
      </div>
    </Providers>
  );
}
