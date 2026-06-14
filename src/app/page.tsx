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
    <div className="min-h-screen flex">

      {/* ── Left panel — hero image ── */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden flex-shrink-0">
        <Image
          src="/assests/login.jpeg"
          alt="GCTU Campus"
          fill
          sizes="55vw"
          className="object-cover"
          priority
        />
        {/* gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a73e8]/80 via-[#174ea6]/60 to-[#0d2d6b]/80" />

        {/* branding text on image */}
        <div className="relative z-10 flex flex-col justify-end p-12 pb-16 text-white">
          <div className="mb-6 flex items-center gap-3">
            <Image src="/logos/gctu-logo.png" alt="GCTU" width={48} height={48} className="object-contain brightness-0 invert" />
            <span className="text-xl font-medium tracking-wide">GCTU</span>
          </div>
          <h2 className="text-4xl font-light leading-tight mb-3">
            Your academic<br />journey, streamlined.
          </h2>
          <p className="text-white/70 text-base font-normal max-w-sm leading-relaxed">
            Access assessments, track your grades, and stay on top of your schedule — all in one place.
          </p>
          <div className="flex gap-2 mt-8">
            <span className="h-1 w-8 rounded-full bg-white" />
            <span className="h-1 w-2 rounded-full bg-white/40" />
            <span className="h-1 w-2 rounded-full bg-white/40" />
          </div>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-6 py-12 overflow-y-auto">
        <div className="w-full max-w-[400px]">

          {/* Form Container */}
          <div className="w-full bg-white border border-[#dadce0] rounded-lg p-10 shadow-sm">

            {/* Heading */}
            <div className="flex flex-col items-center text-center mb-8">
              <div className="mb-4">
                <Image src="/logos/gctu-logo.png" alt="GCTU" width={56} height={56} className="object-contain" />
              </div>
              <h1 className="text-2xl font-normal text-[#202124] tracking-tight">
                Sign in
              </h1>
              <p className="text-[15px] font-normal text-[#5f6368] mt-2">
                to continue to GCTU Assessment
              </p>
            </div>

            <form className="space-y-6" action={formAction}>

              {/* Email */}
              <div className="space-y-1">
                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5f6368] group-focus-within:text-[#1a73e8] transition-colors z-10">
                    <Mail size={18} />
                  </div>
                  <Input
                    id="userId"
                    type="text"
                    name="userId"
                    placeholder="Email or index number"
                    className="w-full h-14 rounded border border-[#dadce0] bg-transparent pl-11  text-base text-[#202124] transition-all focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] placeholder:text-[#5f6368]"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1">
                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5f6368] group-focus-within:text-[#1a73e8] transition-colors pointer-events-none">
                    <Lock size={18} />
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="Enter your password"
                    className="w-full h-14 rounded border border-[#dadce0] bg-transparent pl-11 pr-11 text-base text-[#202124] transition-all focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] placeholder:text-[#5f6368]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full text-[#5f6368] hover:bg-[#f8f9fa] transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* Options */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2.5">
                  <Checkbox
                    id="keepLoggedIn"
                    checked={keepLoggedIn}
                    onCheckedChange={(v) => setKeepLoggedIn(!!v)}
                    className="rounded-sm border-[#dadce0] data-[state=checked]:bg-[#1a73e8] data-[state=checked]:border-[#1a73e8]"
                  />
                  <Label htmlFor="keepLoggedIn" className="text-sm text-[#202124] cursor-pointer select-none font-normal">
                    Remember me
                  </Label>
                </div>
              </div>
              <input type="hidden" name="keepLoggedIn" value={String(keepLoggedIn)} />

              {/* Error */}
              {state?.error && (
                <div className="flex items-start gap-2 p-3 text-[#d93025] text-[13px]">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span className="font-normal leading-tight">{state.error}</span>
                </div>
              )}

              <div className="flex items-center justify-between mt-8 pt-2">
                <a href="#" className="text-sm font-medium text-[#1a73e8] hover:bg-[#f8f9fa] px-2 py-1.5 rounded transition-colors">
                  Forgot password?
                </a>
                <button
                  type="submit"
                  disabled={pending}
                  className="h-10 px-6 rounded text-sm font-medium text-white transition-all hover:bg-[#174ea6] active:bg-[#174ea6] disabled:opacity-50 disabled:pointer-events-none bg-[#1a73e8] flex items-center justify-center"
                >
                  {pending ? (
                    <LoaderIcon />
                  ) : (
                    "Next"
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="w-full flex items-center justify-between text-[12px] text-[#5f6368] mt-6 px-1 font-normal">
            <select className="bg-transparent border-none outline-none cursor-pointer hover:bg-[#f8f9fa] p-1 rounded">
              <option>English (United States)</option>
            </select>
            <div className="flex gap-4">
              <a href="#" className="hover:bg-[#f8f9fa] p-1 rounded transition-colors">Help</a>
              <a href="#" className="hover:bg-[#f8f9fa] p-1 rounded transition-colors">Privacy</a>
              <a href="#" className="hover:bg-[#f8f9fa] p-1 rounded transition-colors">Terms</a>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}

function LoaderIcon() {
  return (
    <svg className="animate-spin size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
