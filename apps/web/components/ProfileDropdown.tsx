import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '~/lib/auth'
import { UserIcon } from './Icons'

export default function ProfileDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { user, signOut } = useAuth()
  const router = useRouter()

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

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
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-md transition-colors hover:bg-surface"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <UserIcon className="w-5 h-5" />
        <span className="hidden md:inline">{displayName}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-surface rounded-md shadow-lg py-1 z-10 border border-gray-200 dark:border-gray-700">
          <div className="px-4 py-2 text-sm border-b border-gray-200 dark:border-gray-700">
            <div className="font-medium">{displayName}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{userEmail}</div>
          </div>
          
          <Link 
            href="/profile" 
            className="block px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => setIsOpen(false)}
          >
            Profile
          </Link>
          
          <Link 
            href="/settings" 
            className="block px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => setIsOpen(false)}
          >
            Settings
          </Link>
          
          <button
            onClick={handleSignOut}
            className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}