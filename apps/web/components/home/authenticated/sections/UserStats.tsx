"use client";

interface UserStatsProps {
  trackedItems?: number;
  potentialSavings?: number;
}

export default function UserStats({ 
  trackedItems = 25, 
  potentialSavings = 2.50 
}: UserStatsProps) {
  return (
    <div className="bg-surface rounded-lg shadow-sm p-6 mb-6">
      <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text)' }}>
        Your Stats
      </h2>
      <div className="space-y-4">
        <div
          className="p-4 rounded-lg text-center"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--primary)',
          }}
        >
          <p className="text-3xl font-bold" style={{ color: 'var(--primary)' }}>
            {trackedItems}
          </p>
          <p className="text-sm opacity-80" style={{ color: 'var(--text)' }}>
            Tracked Items
          </p>
        </div>

        <div
          className="p-4 rounded-lg text-center"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--secondary)',
          }}
        >
          <p className="text-3xl font-bold" style={{ color: 'var(--secondary)' }}>
            ${potentialSavings.toFixed(2)}
          </p>
          <p className="text-sm opacity-80" style={{ color: 'var(--text)' }}>
            Potential Savings
          </p>
        </div>
      </div>
    </div>
  );
} 