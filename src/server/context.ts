import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { getSessionUser } from "./auth";

// Keep the project cookie so the "/" redirect still remembers the last project.
export const PROJECT_COOKIE = "tcm_project";

/**
 * Returns the currently authenticated user, or null if not signed in.
 * Use requireAuth() in pages/layouts that need a guaranteed user.
 */
export const getCurrentUser = getSessionUser;

export const requireAuth = cache(async () => {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
});

export const getProjectByCode = cache(async (code: string) => {
  const project = await db.project.findUnique({ where: { code: code.toUpperCase() } });
  if (!project) notFound();
  return project;
});

/**
 * Returns the projects the current user is a member of.
 * Admins see all projects; members only see their memberships.
 */
export const listUserProjects = cache(async () => {
  const user = await getSessionUser();
  if (!user) return [];

  if (user.role === "admin") {
    return db.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, description: true, updatedAt: true },
    });
  }

  const memberships = await db.projectMember.findMany({
    where: { userId: user.id },
    include: {
      project: {
        select: { id: true, name: true, code: true, description: true, updatedAt: true },
      },
    },
    orderBy: { project: { name: "asc" } },
  });
  return memberships.map((m) => m.project);
});

/** Returns all projects (for the project switcher in the sidebar). */
export const listProjects = cache(async () => {
  const user = await getSessionUser();
  if (!user) return [];

  if (user.role === "admin") {
    return db.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    });
  }

  const memberships = await db.projectMember.findMany({
    where: { userId: user.id },
    include: { project: { select: { id: true, name: true, code: true } } },
    orderBy: { project: { name: "asc" } },
  });
  return memberships.map((m) => m.project);
});

export const listUsers = cache(async () =>
  db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
);

/**
 * Verifies the current user has access to a project.
 * Admins always have access; members must have a ProjectMember record.
 */
export const requireProjectAccess = cache(async (projectCode: string) => {
  const user = await requireAuth();
  const project = await getProjectByCode(projectCode);

  if (user.role === "admin") return { project, user, memberRole: "admin" as const };

  const membership = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId: project.id, userId: user.id } },
  });
  if (!membership) notFound();

  return { project, user, memberRole: membership.role };
});

export async function getProjectCookie(): Promise<string | undefined> {
  return (await cookies()).get(PROJECT_COOKIE)?.value;
}
