import { useEffect, useState } from 'react';
import Hero from '../components/layout/Hero.jsx';
import SizeGuide from '../components/products/SizeGuide.jsx';
import ProductGrid from '../components/products/ProductGrid.jsx';
import LastOrderBanner from '../components/checkout/LastOrderBanner.jsx';
import { getLastOrderRef } from '../utils/storage.js';

export default function Home() {
  const [lastRef, setLastRef] = useState(null);

  useEffect(() => {
    setLastRef(getLastOrderRef());
  }, []);

  return (
    <>
      {lastRef && <LastOrderBanner lastRef={lastRef} onDismiss={() => setLastRef(null)} />}
      <Hero />
      <SizeGuide />
      <ProductGrid />
    </>
  );
}
