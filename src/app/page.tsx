"use client";

import { useState, useActionState } from "react";
import Image from "next/image";
import { loginAction } from "@/app/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [state, formAction, pending] = useActionState(loginAction, null);

  return (
    <div className="min-h-screen flex bg-[#f8f9fa]">

      {/* ── Left panel — scroll image ── */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden flex-shrink-0">
        <Image
          src="/assests/login.jpeg"
          alt="GCTU Campus"
          fill
          sizes="52vw"
          className="object-cover"
          priority
        />
        {/* subtle dark overlay — bottom-heavy so text is readable */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />

        {/* branding text */}
        <div className="relative z-10 flex flex-col justify-end p-12 pb-14 text-white">
          <h2 className="text-[32px] font-light leading-snug mb-2">
            Academic Assessment<br />
            <span className="font-semibold">Portal</span>
          </h2>
          <p className="text-white/60 text-[13px] font-normal max-w-[320px] leading-relaxed">
            Access assessments, track your grades, and stay on top of your
            schedule — all in one place.
          </p>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 overflow-y-auto">
        <div className="w-full max-w-[380px]">

          {/* Logo + heading above the card */}
          <div className="flex flex-col items-center mb-6">
            <Image
              src="/logos/gctu-logo.png"
              alt="GCTU"
              width={52}
              height={52}
              className="object-contain mb-4"
            />
            <h1 className="text-[22px] font-semibold text-[#1e293b] tracking-tight">
              Sign in
            </h1>
            <p className="text-[13px] text-[#605e5c] mt-1">
              Use your GCTU account credentials
            </p>
          </div>

          {/* Card */}
          <div className="w-full bg-white border border-[#e1dfdd] rounded-sm p-8">
            <form className="space-y-4" action={formAction}>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="userId" className="text-[12px] font-semibold text-[#1e293b] uppercase tracking-[0.04em]">
                  Email or Index Number
                </Label>
                <div className="relative group">
                  <Mail
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8886] group-focus-within:text-[#0078d4] transition-colors z-10"
                  />
                  <Input
                    id="userId"
                    type="text"
                    name="userId"
                    placeholder="e.g. 22034819"
                    className="h-[38px] rounded-sm border border-[#8a8886] bg-white pl-9 text-[13px] text-[#1e293b] placeholder:text-[#a19f9d] focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4] transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[12px] font-semibold text-[#1e293b] uppercase tracking-[0.04em]">
                  Password
                </Label>
                <div className="relative group">
                  <Lock
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8886] group-focus-within:text-[#0078d4] transition-colors pointer-events-none"
                  />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="Enter your password"
                    className="h-[38px] rounded-sm border border-[#8a8886] bg-white pl-9 pr-10 text-[13px] text-[#1e293b] placeholder:text-[#a19f9d] focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#8a8886] hover:text-[#1e293b] transition-colors rounded"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="keepLoggedIn"
                  checked={keepLoggedIn}
                  onCheckedChange={(v) => setKeepLoggedIn(!!v)}
                  className="rounded-sm border-[#8a8886] data-[state=checked]:bg-[#0078d4] data-[state=checked]:border-[#0078d4]"
                />
                <Label
                  htmlFor="keepLoggedIn"
                  className="text-[13px] text-[#323130] cursor-pointer select-none font-normal"
                >
                  Keep me signed in
                </Label>
              </div>
              <input type="hidden" name="keepLoggedIn" value={String(keepLoggedIn)} />

              {/* Error */}
              {state?.error && (
                <div className="flex items-start gap-2 p-3 bg-[#fde7e9] border border-[#f4abba] rounded-sm text-[#a4262c] text-[12px]">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{state.error}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-3">
                <a
                  href="#"
                  className="text-[13px] text-[#0078d4] hover:underline font-normal"
                >
                  Forgot password?
                </a>
                <button
                  type="submit"
                  disabled={pending}
                  className="h-[34px] px-5 rounded-sm text-[13px] font-semibold text-white bg-[#0078d4] hover:bg-[#106ebe] active:bg-[#005a9e] transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
                >
                  {pending ? <LoaderIcon /> : "Sign in"}
                </button>
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-[11px] text-[#605e5c] mt-5 px-1">
            <span>© {new Date().getFullYear()} GCTU</span>
            <div className="flex gap-4">
              <a href="#" className="hover:text-[#1e293b] transition-colors">Help</a>
              <a href="#" className="hover:text-[#1e293b] transition-colors">Privacy</a>
              <a href="#" className="hover:text-[#1e293b] transition-colors">Terms</a>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
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
  );
}
