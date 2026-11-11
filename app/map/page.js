import { redirect } from "next/navigation";

/** The map is now the home page; keep old /map links working. */
export default async function MapRedirect({ searchParams }) {
    const q = new URLSearchParams(await searchParams).toString();
    redirect(q ? `/?${q}` : "/");
}
