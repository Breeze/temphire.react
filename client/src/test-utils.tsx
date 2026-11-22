import { MantineProvider } from '@mantine/core';
import { RenderOptions, render } from '@testing-library/react';
import { DataService, EntityManager, MetadataStore } from 'breeze-client';
import { ReactElement } from 'react';

import metadata from '../metadata.json';
import { temphireTheme } from './app/core/theme/temphire-theme';

/**
 * Renders a component for a test, inside the providers it needs - here Mantine's.  The counterpart
 * of `TestBed.configureTestingModule({ providers: [...] })` + `TestBed.createComponent(...)`: a
 * React test renders the component into a detached DOM with Testing Library's `render`, and wraps
 * it in whatever context it reads.
 */
export function renderWithMantine(ui: ReactElement, options?: RenderOptions) {
  return render(<MantineProvider theme={temphireTheme}>{ui}</MantineProvider>, options);
}

/**
 * An EntityManager over the checked-in metadata, for tests that need real Breeze entities.  The
 * model classes are not registered: Breeze binds a class to one metadata store per page.
 */
export function newTestManager(): EntityManager {
  const metadataStore = new MetadataStore();
  metadataStore.importMetadata(metadata);
  return new EntityManager({
    dataService: new DataService({ serviceName: 'api/resourcemgt', hasServerMetadata: false }),
    metadataStore,
  });
}
