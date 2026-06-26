import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import ForceChangePasswordClient from "./ForceChangePasswordClient"

export default async function ForceChangePasswordPage() {
    const session = await getSession()
    if (!session?.user) {
        redirect("/")
    }

    return <ForceChangePasswordClient />
}
