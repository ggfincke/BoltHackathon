"use client";

import HeroSection from '~/components/home/HeroSection';
import FeaturesSection from './sections/FeaturesSection';
import GettingStartedSection from './sections/GettingStartedSection';
import CTASection from './sections/CTASection';

export default function LandingPage() {
  return (
    <div className="space-y-0 -m-6">
      <HeroSection />
      <FeaturesSection />
      <GettingStartedSection />
      <CTASection />
    </div>
  );
}