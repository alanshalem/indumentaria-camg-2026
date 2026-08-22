import { useEffect, useState } from 'react';
import { LastOrderBanner } from '@/components/checkout/LastOrderBanner';
import { Hero } from '@/components/layout/Hero';
import { ProductGrid } from '@/components/products/ProductGrid';
import { SizeChartViewer, SizeGuide } from '@/components/products/SizeGuide';
import { PromoBanner } from '@/components/promotions/PromoBanner';
import { lastOrderStorage, type LastOrderRef } from '@/services/lastOrderStorage';

export function HomePage() {
  const [lastOrder, setLastOrder] = useState<LastOrderRef | null>(null);

  // Se lee después del montaje: en SSR/prerender no hay localStorage.
  useEffect(() => setLastOrder(lastOrderStorage.read()), []);

  return (
    <>
      {lastOrder && <LastOrderBanner lastOrder={lastOrder} onDismiss={() => setLastOrder(null)} />}
      <Hero />
      <PromoBanner />
      <ProductGrid />
      <SizeGuide />
      <SizeChartViewer />
    </>
  );
}
