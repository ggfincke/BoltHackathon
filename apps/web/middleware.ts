import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  
  // Create supabase client with cookie handling
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )
  
  // Log cookies for debugging
  const cookies = req.cookies.getAll()
  const authCookies = cookies.filter(cookie => cookie.name.includes('supabase'))
  console.log('Auth cookies found:', authCookies.length, authCookies.map(c => c.name))
  
  // Use getUser for secure authentication validation
  const {
    data: { user },
    error
  } = await supabase.auth.getUser()

  console.log('Middleware - Path:', req.nextUrl.pathname, 'User:', user?.email || 'None', 'Error:', error?.message || 'None')

  // Check if the request is for a protected route
  const protectedRoutes = ['/profile', '/settings']
  const isProtectedRoute = protectedRoutes.some(route => 
    req.nextUrl.pathname === route || req.nextUrl.pathname.startsWith(`${route}/`)
  )

  // Redirect to login if accessing protected route without auth
  if (isProtectedRoute && !user) {
    console.log('Redirecting to login - no user found')
    const redirectUrl = new URL('/auth/login', req.url)
    redirectUrl.searchParams.set('redirectedFrom', req.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Redirect to home if accessing auth pages while logged in
  const authRoutes = ['/auth/login', '/auth/signup']
  const isAuthRoute = authRoutes.some(route => req.nextUrl.pathname === route)

  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return res
}

export const config = {
  matcher: [
    // Protected routes
    '/profile/:path*',
    '/settings/:path*',
    // Auth routes
    '/auth/login',
    '/auth/signup',
  ],
}