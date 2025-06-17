import Link from 'next/link';

interface BreadcrumbItem {
  name: string;
  slug: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  if (!items || items.length === 0) return null;
  
  return (
    <nav className="mb-6">
      <ol className="flex flex-wrap items-center text-sm">
        {items.map((item, index) => (
          <li key={item.slug || index} className="flex items-center">
            {index > 0 && <span className="mx-2 text-gray-500">/</span>}
            {index === items.length - 1 ? (
              <span className="font-medium">{item.name}</span>
            ) : (
              <Link 
                href={item.slug ? `/categories/${item.slug}` : '/'}
                className="text-primary hover:underline"
              >
                {item.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}