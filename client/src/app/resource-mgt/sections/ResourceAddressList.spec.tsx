import { createValidationService } from '@ideablade/validation';
import { breezeModelType } from '@ideablade/validation/breeze';
import { ValidationProvider } from '@ideablade/validation/react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Entity } from 'breeze-client';
import { vi } from 'vitest';

import { newTestManager, renderWithMantine } from '../../../test-utils';
import { StaffingResource } from '../../core/model';
import { ChangeNotifier } from '../../core/services/change-notifier';
import { ResourceMgtUnitOfWork } from '../../core/services/resource-mgt-unit-of-work';
import { ResourceAddressList } from './ResourceAddressList';

const addressType = { id: crypto.randomUUID(), displayName: 'Work Address' };

// The type dialog: resolves with the chosen type after the click handler has returned.  `vi.mock`
// replaces the module for this test file - the counterpart of providing a stand-in service with
// `{ provide: AppDialogService, useValue: ... }`.
vi.mock('../../core/services/dialog.service', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  openDialog: () => Promise.resolve(addressType),
}));

/**
 * Port of the Angular client's `resource-mgt/sections/resource-address-list.component.spec.ts`.
 *
 * Regression test: an address added after the type dialog closes must appear at once.  The add
 * finishes after an `await`, outside any event in the component; React only re-renders because the
 * unit of work tells it an entity changed (`useUnitOfWork`).
 *
 * The entities are real Breeze entities built from the checked-in metadata, so `addresses` is a
 * real relation array that Breeze changes in place.  The model classes are not registered (Breeze
 * binds a class to one store per page), so `addAddress` is stood in for.
 */
describe('ResourceAddressList', () => {
  function setUp() {
    const manager = newTestManager();

    // A unit of work that notifies on every entity change, as `UnitOfWork` does.
    class TestUnitOfWork extends ChangeNotifier {
      private count = 0;
      readonly version = () => this.count;
      readonly validationErrors = () => [];
      readonly addressTypes = { allInCache: () => [addressType] };
      readonly states = { allInCache: () => [] };
      constructor() {
        super();
        manager.entityChanged.subscribe(() => {
          this.count++;
          this.notify();
        });
      }
    }

    const resource = manager.createEntity('StaffingResource', {
      id: crypto.randomUUID(),
      firstName: 'Steven',
      lastName: 'Buchanan',
    }) as Entity & { id: string };
    const staffingResource = Object.assign(resource, {
      addAddress: (type: { id: string }) =>
        manager.createEntity('Address', {
          id: crypto.randomUUID(),
          addressTypeId: type.id,
          staffingResourceId: resource.id,
        }),
    });

    // The fields use the validation framework's `ValidationForm`; entities supply their own type.
    const validation = createValidationService({ modelTypeResolvers: [breezeModelType] });

    const { container } = renderWithMantine(
      <ValidationProvider service={validation}>
        <ResourceAddressList
          staffingResource={staffingResource as unknown as StaffingResource}
          readOnly={false}
          unitOfWork={new TestUnitOfWork() as unknown as ResourceMgtUnitOfWork}
        />
      </ValidationProvider>,
    );

    return { rows: () => container.querySelectorAll('.address').length };
  }

  it('shows an address added after the type dialog, without another event', async () => {
    const { rows } = setUp();
    expect(rows()).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(rows()).toBe(1));
  });
});
