// Re-export all icons as a namespace
export * as Icons from './ui/Icons';

// Components with default exports
export { default as Pagination } from './ui/Pagination';

// ThemeProvider is a named export
export { ThemeProvider } from './ui/ThemeProvider';

// UI Components
export { default as ThemeToggle } from './ui/ThemeToggle';

// Layout Components
export { default as NavBar } from './layout/NavBar';
export { default as ProfileDropdown } from './layout/ProfileDropdown';
export { default as Breadcrumbs } from './layout/Breadcrumbs';
export { default as SearchDropdown } from './layout/SearchDropdown';

// Home Components
export { default as CategoryGrid } from './home/CategoryGrid';
export { default as HeroSection } from './home/HeroSection';
export { default as AuthenticatedHome } from './home/authenticated/AuthenticatedHome';
export { default as LandingPage } from './home/landing/LandingPage';

// Product Components
export { default as ProductCard } from './product/ProductCard';
export { default as ProductFilters } from './product/ProductFilters';
export { default as ProductGrid } from './product/ProductGrid';
// export { default as ProductTrackingForm } from './product/ProductTrackingForm'; // Disabled - focusing only on basket notifications
export { default as PriceComparisonTable } from './product/PriceComparisonTable';
export { default as PriceHistoryChart } from './product/PriceHistoryChart';

// Shared Components
export { default as AddToBasketModal } from './shared/AddToBasketModal';
export { default as BasketPopup } from './shared/BasketPopup';
export { default as BasketShareModal } from './shared/BasketShareModal';
export { default as BasketTrackingModal } from './shared/BasketTrackingModal';
export { default as ConfirmationModal } from './shared/ConfirmationModal';

export { default as NotificationCenter } from './shared/NotificationCenter';
export { default as AuthForm } from './shared/AuthForm';
export { default as BasketItemsTable } from './shared/BasketItemsTable';
export { default as CategoryCard } from './shared/CategoryCard';
export { default as BoltBadge } from './shared/BoltBadge';
export { default as ConditionalBoltBadge } from './shared/ConditionalBoltBadge'; 