import { Providers } from "@/components/providers";
import { getAuthenticatedUser } from "@/lib/utils/get-user";
import { EditorShell } from "@/components/editor/editor-shell";

export default async function EditorRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await getAuthenticatedUser();

  return (
    <Providers>
      <EditorShell>{children}</EditorShell>
    </Providers>
  );
}
