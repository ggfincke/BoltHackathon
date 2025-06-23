'use client';

import AuthForm from '~/components/shared/AuthForm';

export default function Signup() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Create Account</h1>
      <AuthForm type="signup" />
    </div>
  );
}