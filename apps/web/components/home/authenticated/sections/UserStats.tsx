"use client";

interface UserStatsProps {
  trackedItems?: number;
  potentialSavings?: number;
  avgDiscount?: number;
}

export default function UserStats({ 
  trackedItems = 25, 
  potentialSavings = 2.50, 
  avgDiscount = 15 
}: UserStatsProps) {
  return (
    <div className="bg-surface rounded-lg shadow-sm p-6 h-full flex flex-col">
      <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text)' }}>
        Your Stats
      </h2>
      <div className="flex flex-col justify-between flex-1">
        <div
          className="p-4 rounded-lg text-center flex flex-col justify-center min-h-[80px]"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--primary)',
          }}
        >
          <p className="text-2xl font-bold leading-tight" style={{ color: 'var(--primary)' }}>
            {trackedItems}
          </p>
          <p className="text-sm opacity-80 mt-1" style={{ color: 'var(--text)' }}>
            Tracked Items
          </p>
        </div>

        <div
          className="p-4 rounded-lg text-center flex flex-col justify-center min-h-[80px]"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--secondary)',
          }}
        >
          <p className="text-2xl font-bold leading-tight" style={{ color: 'var(--secondary)' }}>
            ${potentialSavings.toFixed(2)}
          </p>
          <p className="text-sm opacity-80 mt-1" style={{ color: 'var(--text)' }}>
            Potential Savings
          </p>
        </div>

        <div
          className="p-4 rounded-lg text-center flex flex-col justify-center min-h-[80px]"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--accent)',
          }}
        >
          <p className="text-2xl font-bold leading-tight" style={{ color: 'var(--accent)' }}>
            {avgDiscount}%
          </p>
          <p className="text-sm opacity-80 mt-1" style={{ color: 'var(--text)' }}>
            Avg. Discount
          </p>
        </div>
      </div>
    </div>
  );
}