import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import ForceChangePasswordClient from "./ForceChangePasswordClient"

export default async function ForceChangePasswordPage() {
    const session = await auth()
    
    if (!session?.user?.email) {
        redirect("/")
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { mustChangePassword: true }
    })

    if (!user) {
        redirect("/")
    }

    return <ForceChangePasswordClient alreadyChanged={!user.mustChangePassword} />
}
