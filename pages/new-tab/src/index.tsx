import { createRoot } from 'react-dom/client';
import '@src/index.css';
import '@extension/ui/lib/global.css';
import NewTab from '@src/NewTab';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from '../../Redux/store';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './query/queryClient';
import { migrateLocalStorageToChromeStorage } from '@extension/shared/lib/utils';
import { useState, useEffect, Suspense } from 'react';
import { AppearanceProvider } from '@extension/ui';

function AppBootstrapper() {
  useEffect(() => {
    // Run migration in background on mount
    migrateLocalStorageToChromeStorage().catch(err => console.error('[Migration] Background error:', err));
  }, []);

  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <PersistGate loading={<></>} persistor={persistor}>
          <Suspense fallback={<></>}>
            <AppearanceProvider>
              <NewTab />
            </AppearanceProvider>
          </Suspense>
        </PersistGate>
      </QueryClientProvider>
    </Provider>
  );
}

function init() {
  const appContainer = document.querySelector('#app-container');
  if (!appContainer) {
    throw new Error('Can not find #app-container');
  }
  const root = createRoot(appContainer);

  root.render(<AppBootstrapper />);
}

init();
