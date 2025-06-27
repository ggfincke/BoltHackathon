'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '~/lib/auth';
import { supabase } from '~/lib/supabaseClient';

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialType?: 'login' | 'signup' | 'reset';
  redirectTo?: string;
};

type AuthType = 'login' | 'signup' | 'reset';

export default function AuthModal({ isOpen, onClose, initialType = 'login', redirectTo }: AuthModalProps) {
  const [authType, setAuthType] = useState<AuthType>(initialType);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  
  const router = useRouter();
  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Focus management
  useEffect(() => {
    if (isOpen && firstInputRef.current) {
      // Small delay to ensure modal is fully rendered
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, authType]);

  // Keyboard event handling
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      if (event.key === 'Escape') {
        onClose();
      }

      // Tab trapping
      if (event.key === 'Tab') {
        const modal = modalRef.current;
        if (!modal) return;

        const focusableElements = modal.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            event.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            event.preventDefault();
          }
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Reset form when modal opens/closes or auth type changes
  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setError(null);
      setMessage(null);
      setLoading(false);
    }
  }, [isOpen, authType]);

  const validateForm = (): boolean => {
    setError(null);

    if (!email.trim()) {
      setError('Email is required');
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }

    if (authType !== 'reset') {
      if (!password) {
        setError('Password is required');
        return false;
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters long');
        return false;
      }

      if (authType === 'signup') {
        if (!confirmPassword) {
          setError('Please confirm your password');
          return false;
        }

        if (password !== confirmPassword) {
          setError('Passwords do not match');
          return false;
        }
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (authType === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        
        if (error) throw error;
        
        setMessage('Check your email for a confirmation link!');
      } else if (authType === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        
        if (error) throw error;
        
        // Success - close modal and redirect
        onClose();
        if (redirectTo) {
          router.push(redirectTo);
        }
      } else if (authType === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth/update-password`,
        });
        
        if (error) throw error;
        
        setMessage('Check your email for a password reset link!');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getTitle = () => {
    switch (authType) {
      case 'login': return 'Sign In';
      case 'signup': return 'Create Account';
      case 'reset': return 'Reset Password';
    }
  };

  const getButtonText = () => {
    if (loading) return 'Loading...';
    switch (authType) {
      case 'login': return 'Sign In';
      case 'signup': return 'Create Account';
      case 'reset': return 'Send Reset Link';
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="auth-modal-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div 
        ref={modalRef}
        className="auth-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="auth-modal-close"
          aria-label="Close modal"
          type="button"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Modal content */}
        <div className="auth-modal-content">
          <h2 id="auth-modal-title" className="auth-modal-title">
            {getTitle()}
          </h2>

          {error && (
            <div className="auth-modal-error" role="alert">
              {error}
            </div>
          )}

          {message && (
            <div className="auth-modal-success" role="alert">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-modal-form">
            <div className="auth-modal-field">
              <label htmlFor="email" className="auth-modal-label">
                Email address
              </label>
              <input
                ref={firstInputRef}
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="auth-modal-input"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            {authType !== 'reset' && (
              <div className="auth-modal-field">
                <label htmlFor="password" className="auth-modal-label">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={authType === 'login' ? 'current-password' : 'new-password'}
                  required
                  className="auth-modal-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            )}

            {authType === 'signup' && (
              <div className="auth-modal-field">
                <label htmlFor="confirmPassword" className="auth-modal-label">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="auth-modal-input"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="auth-modal-submit"
            >
              {loading && (
                <svg className="auth-modal-spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {getButtonText()}
            </button>
          </form>

          {/* Auth type switcher */}
          <div className="auth-modal-switcher">
            {authType === 'login' && (
              <>
                <button
                  type="button"
                  onClick={() => setAuthType('signup')}
                  className="auth-modal-link"
                  disabled={loading}
                >
                  Don't have an account? Sign up
                </button>
                <button
                  type="button"
                  onClick={() => setAuthType('reset')}
                  className="auth-modal-link"
                  disabled={loading}
                >
                  Forgot your password?
                </button>
              </>
            )}

            {authType === 'signup' && (
              <button
                type="button"
                onClick={() => setAuthType('login')}
                className="auth-modal-link"
                disabled={loading}
              >
                Already have an account? Sign in
              </button>
            )}

            {authType === 'reset' && (
              <button
                type="button"
                onClick={() => setAuthType('login')}
                className="auth-modal-link"
                disabled={loading}
              >
                Back to sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}