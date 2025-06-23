import React, { useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

type PriceHistory = {
  id: string;
  listing_id: string;
  price: number;
  timestamp: string;
  retailer: {
    id: string;
    name: string;
  };
};

interface PriceHistoryChartProps {
  priceHistories: PriceHistory[];
}

// Generate a color based on retailer name for consistent colors
const getRetailerColor = (retailerName: string): string => {
  const colors = [
    '#4299E1', // blue
    '#48BB78', // green
    '#ED8936', // orange
    '#9F7AEA', // purple
    '#F56565', // red
    '#38B2AC', // teal
    '#ED64A6', // pink
    '#ECC94B'  // yellow
  ];
  
  // Simple hash function to get consistent color for same retailer
  let hash = 0;
  for (let i = 0; i < retailerName.length; i++) {
    hash = retailerName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
};

export default function PriceHistoryChart({ priceHistories }: PriceHistoryChartProps) {
  // Process data for the chart
  const chartData = useMemo(() => {
    // Group by date and retailer
    const dataByDate = new Map();
    const retailers = new Set<string>();
    
    priceHistories.forEach(history => {
      const date = new Date(history.timestamp).toLocaleDateString();
      const retailerName = history.retailer.name;
      retailers.add(retailerName);
      
      if (!dataByDate.has(date)) {
        dataByDate.set(date, { date });
      }
      
      const dateEntry = dataByDate.get(date);
      dateEntry[retailerName] = history.price;
    });
    
    // Convert to array and sort by date
    const data = Array.from(dataByDate.values());
    data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    return {
      data,
      retailers: Array.from(retailers)
    };
  }, [priceHistories]);
  
  if (priceHistories.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No price history data available
      </div>
    );
  }

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData.data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }}
            tickMargin={10}
          />
          <YAxis 
            tickFormatter={(value) => `$${value}`}
            tick={{ fontSize: 12 }}
            tickMargin={10}
            domain={['dataMin - 5', 'dataMax + 5']}
          />
          <Tooltip 
            formatter={(value) => [`$${value}`, 'Price']}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <Legend />
          {chartData.retailers.map(retailer => (
            <Line
              key={retailer}
              type="monotone"
              dataKey={retailer}
              name={retailer}
              stroke={getRetailerColor(retailer)}
              activeDot={{ r: 8 }}
              strokeWidth={2}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}