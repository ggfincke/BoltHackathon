import React from 'react';

type FilterOption = {
  id: string;
  name: string;
  count?: number;
};

interface ProductFiltersProps {
  retailers: FilterOption[];
  brands: FilterOption[];
  priceRanges: FilterOption[];
  selectedRetailers: string[];
  selectedBrands: string[];
  selectedPriceRange: string | null;
  onRetailerChange: (retailerId: string) => void;
  onBrandChange: (brandId: string) => void;
  onPriceRangeChange: (rangeId: string | null) => void;
}

export default function ProductFilters({
  retailers,
  brands,
  priceRanges,
  selectedRetailers,
  selectedBrands,
  selectedPriceRange,
  onRetailerChange,
  onBrandChange,
  onPriceRangeChange
}: ProductFiltersProps) {
  return (
    <div className="bg-surface p-4 rounded-lg shadow-sm">
      <h3 className="font-semibold mb-3">Filters</h3>
      
      {/* Retailers filter */}
      <div className="mb-4">
        <h4 className="text-sm font-medium mb-2">Retailers</h4>
        <div className="space-y-1">
          {retailers.map(retailer => (
            <div key={retailer.id} className="flex items-center">
              <input
                type="checkbox"
                id={`retailer-${retailer.id}`}
                checked={selectedRetailers.includes(retailer.id)}
                onChange={() => onRetailerChange(retailer.id)}
                className="mr-2"
              />
              <label htmlFor={`retailer-${retailer.id}`} className="text-sm flex-1">
                {retailer.name}
              </label>
              {retailer.count !== undefined && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({retailer.count})
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Brands filter */}
      {brands.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">Brands</h4>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {brands.map(brand => (
              <div key={brand.id} className="flex items-center">
                <input
                  type="checkbox"
                  id={`brand-${brand.id}`}
                  checked={selectedBrands.includes(brand.id)}
                  onChange={() => onBrandChange(brand.id)}
                  className="mr-2"
                />
                <label htmlFor={`brand-${brand.id}`} className="text-sm flex-1">
                  {brand.name}
                </label>
                {brand.count !== undefined && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({brand.count})
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Price range filter */}
      <div className="mb-4">
        <h4 className="text-sm font-medium mb-2">Price Range</h4>
        <div className="space-y-1">
          <div className="flex items-center">
            <input
              type="radio"
              id="price-all"
              checked={selectedPriceRange === null}
              onChange={() => onPriceRangeChange(null)}
              className="mr-2"
            />
            <label htmlFor="price-all" className="text-sm">
              All Prices
            </label>
          </div>
          {priceRanges.map(range => (
            <div key={range.id} className="flex items-center">
              <input
                type="radio"
                id={`price-${range.id}`}
                checked={selectedPriceRange === range.id}
                onChange={() => onPriceRangeChange(range.id)}
                className="mr-2"
              />
              <label htmlFor={`price-${range.id}`} className="text-sm">
                {range.name}
              </label>
            </div>
          ))}
        </div>
      </div>
      
      {/* Clear all filters button */}
      <button
        onClick={() => {
          onPriceRangeChange(null);
          selectedRetailers.forEach(id => onRetailerChange(id));
          selectedBrands.forEach(id => onBrandChange(id));
        }}
        className="w-full py-2 text-sm bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
      >
        Clear All Filters
      </button>
    </div>
  );
}