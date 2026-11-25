import { createValidationService } from 'ideablade-validation';
import { breezeModelType } from 'ideablade-validation/breeze';
import { ValidationProvider } from 'ideablade-validation/react';
import { act } from '@testing-library/react';

import { newTestManager, renderWithMantine } from '../../../test-utils';
import type { Address, StaffingResource } from '../../core/model';
import { ChangeNotifier } from '../../core/services/change-notifier';
import type { ResourceMgtUnitOfWork } from '../../core/services/resource-mgt-unit-of-work';
import { ResourceAddress } from './ResourceAddress';

/**
 * Port of the "shows a change made outside the card" test in the Angular client's
 * `resource-mgt/sections/resource-address.component.spec.ts`.  Address completion, which the
 * Angular spec also covers there, is tested with the field in `AddressLine1Input.spec.tsx`.
 */
describe('ResourceAddress', () => {
  it('shows a change made outside the card', () => {
    const manager = newTestManager();

    // A unit of work that notifies on every entity change, as `UnitOfWork` does.
    class TestUnitOfWork extends ChangeNotifier {
      private count = 0;
      readonly version = () => this.count;
      readonly states = { allInCache: () => [] };
      constructor() {
        super();
        manager.entityChanged.subscribe(() => {
          this.count++;
          this.notify();
        });
      }
    }

    const address = manager.createEntity('Address', {
      id: crypto.randomUUID(),
      staffingResourceId: crypto.randomUUID(),
      address1: '9 Old Rd',
      city: 'Tacoma',
    }) as unknown as Address;

    const { container } = renderWithMantine(
      <ValidationProvider service={createValidationService({ modelTypeResolvers: [breezeModelType] })}>
        <ResourceAddress
          address={address}
          staffingResource={{} as StaffingResource}
          readOnly={false}
          unitOfWork={new TestUnitOfWork() as unknown as ResourceMgtUnitOfWork}
        />
      </ValidationProvider>,
    );
    const city = () => (container.querySelector(`#city-${address.id}`) as HTMLInputElement).value;
    expect(city()).toBe('Tacoma');

    act(() => {
      address.city = 'Spokane';
    });

    expect(city()).toBe('Spokane');
  });
});
