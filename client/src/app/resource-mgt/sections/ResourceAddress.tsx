import { ValidationForm } from 'ideablade-validation/react';
import { Button, Radio } from '@mantine/core';

import type { Address, StaffingResource } from '../../core/model';
import { useUnitOfWork } from '../../core/hooks/use-unit-of-work';
import type { ResourceMgtUnitOfWork } from '../../core/services/resource-mgt-unit-of-work';
import { EntitySelect, EntityTextInput } from '../../core/validation/EntityFields';
import { AddressLine1Input } from './AddressLine1Input';
import './ResourceAddress.css';

/**
 * One address card: its type as the heading, the address fields, the primary flag and Delete.
 *
 * Port of the Angular client's `resource-mgt/sections/resource-address.component.ts` (and before it
 * of `StaffingResourceAddressItemViewModel.cs` and its row in `StaffingResourceAddressListView.xaml`).
 * The "Set Primary" button of the original is a radio across the cards, which is what the mutually
 * exclusive flag is.  Address 1 suggests U.S. addresses as the user types (`AddressLine1Input`),
 * which the original didn't.
 *
 * `useUnitOfWork` renders the card again whenever an entity in the unit of work changes, so it
 * shows changes made outside it too - another card made primary, Cancel putting the fields back -
 * however its parent renders.  (Angular: the card reads its address through a `computed` that reads
 * `unitOfWork().changes()`.)
 */
export function ResourceAddress({
  address,
  staffingResource,
  readOnly,
  unitOfWork,
}: {
  address: Address;
  staffingResource: StaffingResource;
  readOnly: boolean;
  unitOfWork: ResourceMgtUnitOfWork;
}) {
  useUnitOfWork(unitOfWork);

  // Read from the cache on every render; cheap, since the states are already in memory.
  const states = unitOfWork.states
    .allInCache('name')
    .map((state) => ({ value: state.id, label: state.name }));

  /**
   * Port of `StaffingResourceAddressItemViewModel.CanDelete`, without its "not the primary one, not
   * the last one" condition.  The last address may go too: the user then sees the resource's rule
   * broken, and cannot save until they add one.
   */
  const canDelete = !readOnly;

  /** Port of `StaffingResourceAddressItemViewModel.CanSetPrimary`. */
  const canSetPrimary = !readOnly && !address.primary;

  return (
    <div className="address temphire-elevated">
      <div className="address__header">{address.addressType?.displayName}</div>

      <div className="address__body">
        {/* Validates the address as a whole; each input shows the errors about its property. */}
        <ValidationForm model={address}>
          <div className="address__fields">
            <label htmlFor={`address1-${address.id}`}>Address 1:</label>
            <AddressLine1Input
              id={`address1-${address.id}`}
              address={address}
              stateIds={states.map((state) => state.value)}
              readOnly={readOnly}
            />

            <label htmlFor={`address2-${address.id}`}>Address 2:</label>
            <EntityTextInput id={`address2-${address.id}`} entity={address} property="address2" readOnly={readOnly} />

            <label htmlFor={`city-${address.id}`}>City:</label>
            <EntityTextInput id={`city-${address.id}`} entity={address} property="city" readOnly={readOnly} />

            <label htmlFor={`state-${address.id}`}>State:</label>
            <EntitySelect
              id={`state-${address.id}`}
              entity={address}
              property="stateId"
              data={states}
              disabled={readOnly}
              searchable
              className="address__state"
            />

            <label htmlFor={`zipcode-${address.id}`}>Zipcode:</label>
            <EntityTextInput
              id={`zipcode-${address.id}`}
              className="address__zipcode"
              entity={address}
              property="zipcode"
              readOnly={readOnly}
            />
          </div>
        </ValidationForm>

        <div className="address__actions">
          <Radio
            name="primary-address"
            label="Primary"
            checked={address.primary}
            disabled={!canSetPrimary}
            onChange={() => staffingResource.setPrimaryAddress(address)}
          />

          <Button
            size="xs"
            color="red"
            variant="outline"
            disabled={!canDelete}
            onClick={() => staffingResource.deleteAddress(address)}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
