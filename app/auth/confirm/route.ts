import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/'

  console.log("🔍 [Auth Confirm] URL Params:", { token_hash, type, next })

  const redirectTo = request.nextUrl.clone()
  redirectTo.pathname = next
  redirectTo.searchParams.delete('token_hash')
  redirectTo.searchParams.delete('type')
  redirectTo.searchParams.delete('next')

  if (token_hash && type) {
    let response = NextResponse.redirect(redirectTo)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
          },
        },
      }
    )

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })

    if (!error) {
      console.log("✅ [Auth Confirm] Verification successful. Redirecting to:", next)
      return response
    } else {
      console.log("❌ [Auth Confirm] Verification failed:", error.message)
    }
  } else {
     console.log("❌ [Auth Confirm] Missing token_hash or type")
  }

  // If verification fails, go to login with an error
  redirectTo.pathname = '/login'
  redirectTo.searchParams.set('error', 'Invalid or expired reset link. Please try again.')
  return NextResponse.redirect(redirectTo)
}