import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Providers } from '@/app/providers';
import { createAppRouter } from '@/app/router';
import { createQueryClient } from '@/lib/query/client';

// Inter, self-hosted (DESIGN_SYSTEM.md → Typography): the variable wght axis;
// the browser downloads only the subsets a page uses (latin: 48 kB woff2).
import '@fontsource-variable/inter/wght.css';
import '@/styles/globals.css';

const queryClient = createQueryClient();
const router = createAppRouter(queryClient);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <Providers queryClient={queryClient}>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
);
