export interface BestDeal {
  id: string;
  productName: string;
  productSlug: string;
  retailer: string;
  oldPrice: number;
  newPrice: number;
  percentChange: number;
  imageUrl: string;
}

export const MOCK_DEALS: BestDeal[] = [
  {
    id: '1',
    productName: 'Organic Milk',
    productSlug: 'organic-milk',
    retailer: 'Target',
    oldPrice: 4.99,
    newPrice: 3.49,
    percentChange: -30,
    imageUrl: 'https://images.pexels.com/photos/2510584/pexels-photo-2510584.jpeg?auto=compress&cs=tinysrgb&w=300',
  },
  {
    id: '2',
    productName: 'Cheerios Cereal',
    productSlug: 'cheerios-cereal',
    retailer: 'Walmart',
    oldPrice: 3.99,
    newPrice: 2.99,
    percentChange: -25,
    imageUrl: 'https://images.pexels.com/photos/135525/pexels-photo-135525.jpeg?auto=compress&cs=tinysrgb&w=300',
  },
  {
    id: '3',
    productName: 'Pasta Sauce',
    productSlug: 'pasta-sauce',
    retailer: 'Target',
    oldPrice: 3.99,
    newPrice: 2.79,
    percentChange: -30,
    imageUrl: 'https://images.pexels.com/photos/1435904/pexels-photo-1435904.jpeg?auto=compress&cs=tinysrgb&w=300',
  },
  {
    id: '4',
    productName: 'Greek Yogurt',
    productSlug: 'greek-yogurt',
    retailer: 'Walmart',
    oldPrice: 5.49,
    newPrice: 4.49,
    percentChange: -18,
    imageUrl: 'https://images.pexels.com/photos/1435904/pexels-photo-1435904.jpeg?auto=compress&cs=tinysrgb&w=300',
  },
  {
    id: '5',
    productName: 'Chicken Breast',
    productSlug: 'chicken-breast',
    retailer: 'Target',
    oldPrice: 8.99,
    newPrice: 6.99,
    percentChange: -22,
    imageUrl: 'https://images.pexels.com/photos/616401/pexels-photo-616401.jpeg?auto=compress&cs=tinysrgb&w=300',
  },
  {
    id: '6',
    productName: 'Olive Oil',
    productSlug: 'olive-oil',
    retailer: 'Walmart',
    oldPrice: 7.99,
    newPrice: 6.49,
    percentChange: -19,
    imageUrl: 'https://images.pexels.com/photos/33783/olive-oil-salad-dressing-cooking-olive.jpg?auto=compress&cs=tinysrgb&w=300',
  },
  {
    id: '7',
    productName: 'Frozen Pizza',
    productSlug: 'frozen-pizza',
    retailer: 'Walmart',
    oldPrice: 6.49,
    newPrice: 4.99,
    percentChange: -23,
    imageUrl: 'https://images.pexels.com/photos/825661/pexels-photo-825661.jpeg?auto=compress&cs=tinysrgb&w=300',
  },
  {
    id: '8',
    productName: 'Orange Juice',
    productSlug: 'orange-juice',
    retailer: 'Target',
    oldPrice: 4.19,
    newPrice: 3.29,
    percentChange: -21,
    imageUrl: 'https://images.pexels.com/photos/96974/pexels-photo-96974.jpeg?auto=compress&cs=tinysrgb&w=300',
  },
]; 