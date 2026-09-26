import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser } from "@/server/auth";
import { PROJECT_COOKIE } from "@/server/context";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const store = await cookies();
  const remembered = store.get(PROJECT_COOKIE)?.value;

  // For admins, check any remembered/first project
  if (user.role === "admin") {
    const project =
      (remembered && (await db.project.findUnique({ where: { code: remembered }, select: { code: true } }))) ||
      (await db.project.findFirst({ orderBy: { createdAt: "asc" }, select: { code: true } }));
    redirect(project ? `/p/${project.code}/dashboard` : "/projects");
  }

  // For members, check remembered project within their accessible ones
  const memberships = await db.projectMember.findMany({
    where: { userId: user.id },
    include: { project: { select: { code: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (!memberships.length) redirect("/projects");

  const accessible = memberships.map((m) => m.project.code);
  const target =
    (remembered && accessible.includes(remembered) && remembered) ||
    memberships[0].project.code;

  redirect(`/p/${target}/dashboard`);
}
