import { redirect } from "next/navigation";

/** The map is now the /glacier page; keep old /glacier/map links working. */
export default async function GlacierMapRedirect({ searchParams }) {
    const q = new URLSearchParams(await searchParams).toString();
    redirect(q ? `/glacier?${q}` : "/glacier");
}
