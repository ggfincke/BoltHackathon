"use client";

// main page 

import { useAuth } from '~/lib/auth';
import LandingPage from '~/components/home/landing/LandingPage';
import AuthenticatedHome from '~/components/home/authenticated/AuthenticatedHome';

export default function Home() {
  const { user } = useAuth();
  return user ? <AuthenticatedHome /> : <LandingPage />;
}