"use client"

import { useState } from "react"
import { signOut } from "next-auth/react"
import Image from "next/image"
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

export default function ForceChangePasswordPage() {
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [showNew, setShowNew] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isSuccess, setIsSuccess] = useState(false)

    // Password strength indicators
    const hasMinLength = newPassword.length >= 8
    const hasUppercase = /[A-Z]/.test(newPassword)
    const hasNumber = /[0-9]/.test(newPassword)
    const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)

        if (!hasMinLength) {
            setError("Password must be at least 8 characters long")
            return
        }
        if (!passwordsMatch) {
            setError("Passwords do not match")
            return
        }

        setLoading(true)
        try {
            const res = await fetch("/api/auth/force-change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ newPassword }),
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || "Failed to change password")
            }

            toast.success("Password changed successfully")
            setIsSuccess(true)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] px-4 py-12">
            <div className="w-full max-w-[440px]">
                {/* Logo + Welcome */}
                <div className="flex flex-col items-center mb-6">
                    <Image
                        src="/logos/gctu-logo.png"
                        alt="GCTU"
                        width={52}
                        height={52}
                        className="object-contain mb-4"
                    />
                    <div className="flex items-center gap-2 mb-2">
                        <ShieldCheck size={20} className="text-[#002388]" />
                        <h1 className="text-[20px] font-semibold text-[#1e293b] tracking-tight">
                            Welcome to GCTU Exam Portal
                        </h1>
                    </div>
                    <p className="text-[13px] text-[#605e5c] text-center max-w-sm">
                        For your security, you must set a new password before accessing the system. This is a one-time requirement.
                    </p>
                </div>

                {/* Card */}
                <div className="w-full bg-white border border-[#e1dfdd] rounded-sm p-8">
                    {isSuccess ? (
                        <div className="text-center space-y-4 py-4">
                            <div className="flex justify-center mb-4">
                                <CheckCircle2 size={48} className="text-emerald-500" />
                            </div>
                            <h2 className="text-[18px] font-semibold text-[#1e293b]">Password Changed Successfully</h2>
                            <p className="text-[13px] text-[#605e5c]">
                                Your password has been updated. Please login again to continue.
                            </p>
                            <button
                                onClick={() => signOut({ callbackUrl: "/" })}
                                className="w-full h-[38px] mt-6 rounded-sm text-[13px] font-semibold text-[#002388] border border-[#002388] hover:bg-[#f3f6fc] active:bg-[#e4ebf7] transition-colors"
                            >
                                Logout & Login Again
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">

                            {/* Info banner */}
                            <div className="flex items-start gap-2.5 p-3 bg-[#dce6f7] border border-[#b8cef0] rounded-sm">
                                <Lock size={14} className="text-[#002388] shrink-0 mt-0.5" />
                                <p className="text-[12px] text-[#1e293b] leading-relaxed">
                                    Choose a strong password that you haven't used elsewhere. You'll use this to sign in going forward.
                                </p>
                            </div>

                            {/* New Password */}
                            <div className="space-y-1.5">
                                <Label htmlFor="newPassword" className="text-[12px] font-semibold text-[#1e293b] uppercase tracking-[0.04em]">
                                    New Password
                                </Label>
                                <div className="relative group">
                                    <Lock
                                        size={15}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8886] group-focus-within:text-[#002388] transition-colors pointer-events-none"
                                    />
                                    <Input
                                        id="newPassword"
                                        type={showNew ? "text" : "password"}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Enter new password"
                                        className="h-[38px] rounded-sm border border-[#8a8886] bg-white pl-9 pr-10 text-[13px] text-[#1e293b] placeholder:text-[#a19f9d] focus:border-[#002388] focus:ring-1 focus:ring-[#002388] transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNew(!showNew)}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#8a8886] hover:text-[#1e293b] transition-colors rounded"
                                    >
                                        {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                                    </button>
                                </div>
                            </div>

                            {/* Confirm Password */}
                            <div className="space-y-1.5">
                                <Label htmlFor="confirmPassword" className="text-[12px] font-semibold text-[#1e293b] uppercase tracking-[0.04em]">
                                    Confirm Password
                                </Label>
                                <div className="relative group">
                                    <Lock
                                        size={15}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8886] group-focus-within:text-[#002388] transition-colors pointer-events-none"
                                    />
                                    <Input
                                        id="confirmPassword"
                                        type={showConfirm ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Re-enter new password"
                                        className="h-[38px] rounded-sm border border-[#8a8886] bg-white pl-9 pr-10 text-[13px] text-[#1e293b] placeholder:text-[#a19f9d] focus:border-[#002388] focus:ring-1 focus:ring-[#002388] transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirm(!showConfirm)}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#8a8886] hover:text-[#1e293b] transition-colors rounded"
                                    >
                                        {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                                    </button>
                                </div>
                            </div>

                            {/* Password requirements */}
                            <div className="space-y-1.5 pt-1">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
                                    Password requirements
                                </p>
                                <div className="grid grid-cols-1 gap-1.5">
                                    <Requirement met={hasMinLength} label="At least 8 characters" />
                                    <Requirement met={hasUppercase} label="One uppercase letter" />
                                    <Requirement met={hasNumber} label="One number" />
                                    <Requirement met={passwordsMatch} label="Passwords match" />
                                </div>
                            </div>

                            {/* Error */}
                            {error && (
                                <div className="flex items-start gap-2 p-3 bg-[#fde7e9] border border-[#f4abba] rounded-sm text-[#a4262c] text-[12px]">
                                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={loading || !hasMinLength || !passwordsMatch}
                                className="w-full h-[38px] rounded-sm text-[13px] font-semibold text-white bg-[#002388] hover:bg-[#001a66] active:bg-[#005a9e] transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                            >
                                {loading ? <LoaderIcon /> : <ShieldCheck size={15} />}
                                {loading ? "Updating..." : "Set Password & Continue"}
                            </button>
                        </form>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-center text-[11px] text-[#605e5c] mt-5">
                    <span>© {new Date().getFullYear()} Ghana Communication Technology University</span>
                </div>
            </div>
        </div>
    )
}

function Requirement({ met, label }: { met: boolean; label: string }) {
    return (
        <div className="flex items-center gap-2">
            {met ? (
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
            ) : (
                <div className="h-3.5 w-3.5 rounded-full border border-[#8a8886] shrink-0" />
            )}
            <span className={`text-[12px] ${met ? "text-emerald-600 font-medium" : "text-[#605e5c]"}`}>
                {label}
            </span>
        </div>
    )
}

function LoaderIcon() {
    return (
        <svg
            className="animate-spin size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
    )
}
