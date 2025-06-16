'use client';

import AuthForm from '~/components/AuthForm';

export default function ResetPassword() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Reset Password</h1>
      <AuthForm type="reset" />
    </div>
  );
}