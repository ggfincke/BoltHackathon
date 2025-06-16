import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '~/lib/auth'

type AuthFormProps = {
  type: 'login' | 'signup' | 'reset'
}

export default function AuthForm({ type }: AuthFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  
  const router = useRouter()
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
        
        const { error } = await signUp(email, password)
        if (error) throw error
        
        setMessage('Check your email for the confirmation link')
      } else if (type === 'login') {
        const { error } = await signIn(email, password)
        if (error) throw error
        
        router.push('/')
      } else if (type === 'reset') {
        const { error } = await resetPassword(email)
        if (error) throw error
        
        setMessage('Check your email for the password reset link')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="bg-surface p-8 rounded-lg shadow-sm">
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}
        
        {message && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md">
            {message}
          </div>
        )}
        
        <div className="mb-4">
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-background"
            required
          />
        </div>
        
        {type !== 'reset' && (
          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-background"
              required
            />
          </div>
        )}
        
        {type === 'signup' && (
          <div className="mb-4">
            <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-background"
              required
            />
          </div>
        )}
        
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-buttonText py-2 px-4 rounded-md hover:bg-opacity-90 transition-colors disabled:opacity-50"
        >
          {loading ? 'Processing...' : type === 'login' ? 'Sign In' : type === 'signup' ? 'Sign Up' : 'Reset Password'}
        </button>
        
        <div className="mt-4 text-center text-sm">
          {type === 'login' ? (
            <>
              <Link href="/auth/reset" className="text-primary hover:underline">
                Forgot password?
              </Link>
              <div className="mt-2">
                Don't have an account?{' '}
                <Link href="/auth/signup" className="text-primary hover:underline">
                  Sign up
                </Link>
              </div>
            </>
          ) : type === 'signup' ? (
            <div>
              Already have an account?{' '}
              <Link href="/auth/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </div>
          ) : (
            <div>
              Remember your password?{' '}
              <Link href="/auth/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </div>
          )}
        </div>
      </form>
    </div>
  )
}