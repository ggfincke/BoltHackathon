import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '~/lib/auth'
import { UserIcon } from '../ui/Icons'

export default function ProfileDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { user, signOut } = useAuth()
  const router = useRouter()

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleSignOut = async () => {
    await signOut()
    setIsOpen(false)
    router.push('/')
  }

  const userEmail = user?.email || ''
  const displayName = userEmail.split('@')[0] || 'User'

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-md transition-all duration-200 hover:bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
        style={{ 
          background: isOpen ? 'var(--surface)' : 'transparent',
          borderColor: isOpen ? 'var(--primary)' : 'transparent'
        }}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="User menu"
      >
        <UserIcon className="w-5 h-5" />
        <span className="hidden md:inline">{displayName}</span>
        <svg 
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <div className="fixed inset-0 z-40 md:hidden bg-black/40 backdrop-blur-md" onClick={() => setIsOpen(false)} />
          
          {/* Dropdown menu */}
          <div 
            className="absolute right-0 top-full mt-2 w-64 border rounded-xl shadow-2xl z-50 overflow-hidden backdrop-blur-xl"
            style={{
              background: 'rgba(var(--background-rgb), 0.85)',
              borderColor: 'var(--surface)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(var(--background-rgb), 0.05)'
            }}
          >
            {/* User info header */}
            <div 
              className="px-4 py-4 border-b"
              style={{
                background: `linear-gradient(135deg, var(--surface), var(--background))`,
                borderBottomColor: 'var(--surface)'
              }}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center font-semibold shadow-lg text-white"
                  style={{
                    background: `linear-gradient(135deg, var(--primary), var(--secondary))`
                  }}
                >
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate" style={{ color: 'var(--text)' }}>{displayName}</div>
                  <div className="text-xs opacity-60 truncate" style={{ color: 'var(--text)' }}>{userEmail}</div>
                </div>
              </div>
            </div>
            
            {/* Menu items */}
            <div className="py-2">
              <Link 
                href="/profile" 
                className="flex items-center gap-3 px-4 py-3 text-sm transition-all duration-200 hover:translate-x-1 hover:shadow-md border-l-2 border-transparent group"
                style={{
                  background: 'var(--surface)',
                  color: 'var(--text)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `linear-gradient(90deg, rgba(133, 209, 231, 0.2), rgba(198, 91, 130, 0.2))`
                  e.currentTarget.style.borderLeftColor = 'var(--primary)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--surface)'
                  e.currentTarget.style.borderLeftColor = 'transparent'
                }}
                onClick={() => setIsOpen(false)}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="font-medium">Profile</span>
              </Link>
              
              <Link 
                href="/settings" 
                className="flex items-center gap-3 px-4 py-3 text-sm transition-all duration-200 hover:translate-x-1 hover:shadow-md border-l-2 border-transparent group"
                style={{
                  background: 'var(--surface)',
                  color: 'var(--text)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `linear-gradient(90deg, rgba(133, 209, 231, 0.2), rgba(198, 91, 130, 0.2))`
                  e.currentTarget.style.borderLeftColor = 'var(--primary)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--surface)'
                  e.currentTarget.style.borderLeftColor = 'transparent'
                }}
                onClick={() => setIsOpen(false)}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="font-medium">Settings</span>
              </Link>
              
              <Link 
                href="/settings/notifications" 
                className="flex items-center gap-3 px-4 py-3 text-sm transition-all duration-200 hover:translate-x-1 hover:shadow-md border-l-2 border-transparent group"
                style={{
                  background: 'var(--surface)',
                  color: 'var(--text)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `linear-gradient(90deg, rgba(133, 209, 231, 0.2), rgba(198, 91, 130, 0.2))`
                  e.currentTarget.style.borderLeftColor = 'var(--primary)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--surface)'
                  e.currentTarget.style.borderLeftColor = 'transparent'
                }}
                onClick={() => setIsOpen(false)}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="font-medium">Notification Settings</span>
              </Link>

              {/* Special "Show Best Deals" item */}
              <Link 
                href="/best-deals" 
                className="flex items-center justify-between px-4 py-3 text-sm transition-all duration-200 hover:translate-x-1 hover:shadow-md border-l-2 group"
                style={{
                  background: `linear-gradient(90deg, rgba(111, 80, 111, 0.15), rgba(133, 209, 231, 0.15))`,
                  borderLeftColor: 'var(--accent)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `linear-gradient(90deg, rgba(111, 80, 111, 0.25), rgba(133, 209, 231, 0.25))`
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = `linear-gradient(90deg, rgba(111, 80, 111, 0.15), rgba(133, 209, 231, 0.15))`
                }}
                onClick={() => setIsOpen(false)}
              >
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span className="font-medium" style={{ color: 'var(--primary)' }}>Show Best Deals</span>
                </div>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            
            {/* Divider */}
            <div className="border-t" style={{ borderColor: 'var(--surface)' }} />
            
            {/* Sign out */}
            <div className="py-2">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 w-full px-4 py-3 text-sm transition-all duration-200 hover:translate-x-1 hover:shadow-md border-l-2 border-transparent group"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(90deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.2))'
                  e.currentTarget.style.borderLeftColor = '#ef4444'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'
                  e.currentTarget.style.borderLeftColor = 'transparent'
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="font-medium">Sign out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}