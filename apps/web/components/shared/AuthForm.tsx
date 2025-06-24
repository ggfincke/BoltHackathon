'use client';

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '~/lib/auth'
import { supabase } from '~/lib/supabaseClient'

type AuthFormProps = {
  type: 'login' | 'signup' | 'reset'
  onToggle?: (type: 'login' | 'signup' | 'reset') => void
}

export default function AuthForm({ type, onToggle }: AuthFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const { signIn, signUp, resetPassword } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    try {
      if (type === 'signup') {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match')
        }
        
        const { error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error
        
        setMessage('Check your email for a confirmation link!')
      } else if (type === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        
        // Check if there's a redirect parameter
        const redirectTo = searchParams.get('redirectedFrom') || '/'
        router.push(redirectTo)
      } else if (type === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/update-password`,
        })
        if (error) throw error
        
        setMessage('Check your email for a password reset link!')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const getTitle = () => {
    switch (type) {
      case 'login': return 'Sign In'
      case 'signup': return 'Create Account'
      case 'reset': return 'Reset Password'
    }
  }

  const getButtonText = () => {
    if (loading) return 'Loading...'
    switch (type) {
      case 'login': return 'Sign In'
      case 'signup': return 'Create Account'
      case 'reset': return 'Send Reset Link'
    }
  }

  return (
    <div className="max-w-md w-full space-y-8">
      <div>
        <h2 className="mt-6 text-center text-3xl font-extrabold">{getTitle()}</h2>
      </div>
      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label htmlFor="email" className="sr-only">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="form-input"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          
          {type !== 'reset' && (
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={type === 'login' ? 'current-password' : 'new-password'}
                required
                className="form-input"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}
          
          {type === 'signup' && (
            <div>
              <label htmlFor="confirmPassword" className="sr-only">Confirm Password</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                className="form-input"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {message && (
          <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded">
            {message}
          </div>
        )}

        <div>
          <button
            type="submit"
            disabled={loading}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
          >
            {getButtonText()}
          </button>
        </div>

        <div className="text-center space-y-2">
          {type === 'login' && onToggle && (
            <>
              <button
                type="button"
                onClick={() => onToggle('signup')}
                className="text-primary hover:underline"
              >
                Don't have an account? Sign up
              </button>
              <br />
              <button
                type="button"
                onClick={() => onToggle('reset')}
                className="text-primary hover:underline"
              >
                Forgot your password?
              </button>
            </>
          )}
          
          {type === 'signup' && onToggle && (
            <button
              type="button"
              onClick={() => onToggle('login')}
              className="text-primary hover:underline"
            >
              Already have an account? Sign in
            </button>
          )}
          
          {type === 'reset' && onToggle && (
            <button
              type="button"
              onClick={() => onToggle('login')}
              className="text-primary hover:underline"
            >
              Back to sign in
            </button>
          )}
        </div>
      </form>
    </div>
  )
}