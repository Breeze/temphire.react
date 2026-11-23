import { useEntityStoreValidation, useErrorVisibility, useErrorVisibilityVersion } from 'ideablade-validation/react';
import { Loader, Tabs } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { Suspense, lazy, useState } from 'react';

import { StaffingResource } from '../core/model';
import { ResourceMgtUnitOfWork } from '../core/services/resource-mgt-unit-of-work';
import './ResourceDetail.css';
import { ResourceSummary } from './ResourceSummary';
import { RESOURCE_TABS, countByTab } from './resource-tabs';
import { ResourceContactInfo } from './sections/ResourceContactInfo';

// Each loaded, as its own chunk, the first time its tab is opened - Angular's `@defer`.
const ResourceRates = lazy(() =>
  import('./sections/ResourceRates').then((m) => ({ default: m.ResourceRates })),
);
const ResourceWorkExperience = lazy(() =>
  import('./sections/ResourceWorkExperience').then((m) => ({ default: m.ResourceWorkExperience })),
);
const ResourceSkills = lazy(() =>
  import('./sections/ResourceSkills').then((m) => ({ default: m.ResourceSkills })),
);

/** What every detail section gets: the resource, the edit mode, and the unit of work it lives in. */
export interface SectionProps {
  staffingResource: StaffingResource;
  readOnly: boolean;
  unitOfWork: ResourceMgtUnitOfWork;
}

/**
 * The summary header above a tab control whose pages are the detail sections.
 *
 * Port of the Angular client's `resource-mgt/resource-detail.component.ts` (and before it of
 * `StaffingResourceDetailViewModel.cs`).  The WPF app discovered its sections through MEF; the
 * sections are listed here explicitly, in the same order their `Index` values gave them: Contact
 * Information (0), Rates (10), Work Experience (20), Skills (30).
 *
 * **Lazy tabs.**  Angular deferred the last three tabs with `@defer (when activeTab() === ...)`.
 * React's counterpart is `lazy(() => import(...))`, which loads a component's code the first time
 * it renders, and `<Suspense>`, which shows a fallback until it has.  Here a tab's content renders
 * - and so loads - once the tab has been opened (`opened`), and stays after that.
 */
export function ResourceDetail({ staffingResource, readOnly, unitOfWork }: SectionProps) {
  /**
   * Port of `StaffingResourceDetailViewModel.ActiveSectionIndex`.  This component's state survives
   * when the parent loads another resource or switches between view and edit mode - React keeps a
   * component, and its state, as long as it renders in the same place - so the user stays on the
   * section they were looking at, as in the original.
   */
  const [activeTab, setActiveTab] = useState<string>('contact');
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set(['contact']));

  function selectTab(tab: string | null): void {
    if (tab) {
      setActiveTab(tab);
      setOpened((current) => (current.has(tab) ? current : new Set(current).add(tab)));
    }
  }

  /**
   * How many errors each tab has to show, so a tab with a problem is marked before the user opens
   * it.  They come from the continuous validation of the route's unit of work, which the Save
   * button and the address and phone lists use too, not from the fields: the lazy tabs have none
   * until they are opened.  Only the errors the screen shows count (`ErrorVisibility`, in
   * `ResourceMgt`), so a new resource's tabs are not marked until the user breaks a rule or tries
   * to save.
   */
  const validation = useEntityStoreValidation();
  const visibility = useErrorVisibility();
  // Re-renders this when a touch or a save attempt changes what the visibility shows.
  useErrorVisibilityVersion(visibility);
  const errorCounts = countByTab(
    (validation?.validationErrors ?? []).filter((error) => visibility?.isShown(error.model, error) ?? true),
  );

  const props: SectionProps = { staffingResource, readOnly, unitOfWork };

  return (
    <div className="detail">
      <ResourceSummary staffingResource={staffingResource} readOnly={readOnly} unitOfWork={unitOfWork} />

      <Tabs value={activeTab} onChange={selectTab} className="detail__tabs temphire-card">
        <Tabs.List>
          {RESOURCE_TABS.map((tab) => {
            const count = errorCounts[tab.value];
            return (
              <Tabs.Tab key={tab.value} value={tab.value}>
                {tab.label}
                {count > 0 && (
                  <>
                    <span className="detail__tab-errors" aria-hidden="true">
                      <IconAlertCircle size={12} stroke={2.5} />
                      {count}
                    </span>
                    <span className="temphire-visually-hidden">
                      {count === 1 ? ' (1 error)' : ` (${count} errors)`}
                    </span>
                  </>
                )}
              </Tabs.Tab>
            );
          })}
        </Tabs.List>

        <Tabs.Panel value="contact">
          <ResourceContactInfo {...props} />
        </Tabs.Panel>
        <Tabs.Panel value="rates">
          <Suspense fallback={<Loader size="sm" />}>
            {opened.has('rates') && <ResourceRates {...props} />}
          </Suspense>
        </Tabs.Panel>
        <Tabs.Panel value="work">
          <Suspense fallback={<Loader size="sm" />}>
            {opened.has('work') && <ResourceWorkExperience {...props} />}
          </Suspense>
        </Tabs.Panel>
        <Tabs.Panel value="skills">
          <Suspense fallback={<Loader size="sm" />}>
            {opened.has('skills') && <ResourceSkills {...props} />}
          </Suspense>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
