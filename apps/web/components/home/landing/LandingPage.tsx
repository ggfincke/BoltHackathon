"use client";

import HeroSection from '~/components/home/HeroSection';
import FeaturesSection from './sections/FeaturesSection';
import GettingStartedSection from './sections/GettingStartedSection';
import CTASection from './sections/CTASection';

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <FeaturesSection />
      <GettingStartedSection />
      <CTASection />
    </div>
  );
}