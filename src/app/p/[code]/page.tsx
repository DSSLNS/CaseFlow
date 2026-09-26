import { redirect } from "next/navigation";

export default async function ProjectIndex({ params }: PageProps<"/p/[code]">) {
  const { code } = await params;
  redirect(`/p/${code}/dashboard`);
}
