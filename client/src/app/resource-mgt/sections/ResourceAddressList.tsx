import { Button, Radio } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';

import { Address, AddressType } from '../../core/model';
import { useUnitOfWork } from '../../core/hooks/use-unit-of-work';
import { DialogCancelledError, openDialog } from '../../core/services/dialog.service';
import { showError } from '../../core/services/error-handler';
import { EntitySelect, EntityTextInput } from '../../core/validation/EntityFields';
import { ItemSelector } from '../ItemSelector';
import type { SectionProps } from '../ResourceDetail';
import './ResourceAddressList.css';

/**
 * One editable card per address, with the address type as its heading, and an Add button above.
 *
 * Port of the Angular client's `resource-mgt/sections/resource-address-list.component.ts` (and
 * before it of `StaffingResourceAddressListViewModel.cs` + `StaffingResourceAddressItemViewModel.cs`).
 * The "Set Primary" button of the original is a radio, which is what the mutually exclusive flag
 * is; the states come from the cache, which was seeded at sign-in.
 *
 * `useUnitOfWork` re-renders this list whenever an entity in the unit of work changes: Breeze
 * changes `staffingResource.addresses` in place when an address is added or deleted, which React
 * could not see otherwise.  (Angular: a `computed` that read `unitOfWork().changes()`.)
 */
export function ResourceAddressList({ staffingResource, readOnly, unitOfWork }: SectionProps) {
  useUnitOfWork(unitOfWork);

  const addresses = [...staffingResource.addresses];
  // Read from the cache on every render; cheap, since the states are already in memory.
  const states = unitOfWork.states
    .allInCache('name')
    .map((state) => ({ value: state.id, label: state.name }));

  /** Port of `StaffingResourceAddressItemViewModel.CanDelete`. */
  const canDelete = (address: Address) =>
    !readOnly && !address.primary && staffingResource.addresses.length > 1;

  /** Port of `StaffingResourceAddressItemViewModel.CanSetPrimary`. */
  const canSetPrimary = (address: Address) => !readOnly && !address.primary;

  /** Port of `StaffingResourceAddressListViewModel.Add`: pick a type, then create the address. */
  async function add(): Promise<void> {
    if (readOnly) {
      return;
    }

    try {
      const addressType = await openDialog<AddressType>(
        (close) => (
          <ItemSelector
            prompt="Select type:"
            items={unitOfWork.addressTypes.allInCache('displayName')}
            label={(type) => type.displayName}
            onClose={close}
          />
        ),
        { title: 'Add an address', size: '24rem' },
      );
      staffingResource.addAddress(addressType);
    } catch (error) {
      if (!(error instanceof DialogCancelledError)) {
        showError(error);
      }
    }
  }

  return (
    <div className="addresses">
      <Button
        size="xs"
        variant="outline"
        leftSection={<IconPlus size={14} />}
        disabled={readOnly}
        onClick={() => void add()}
      >
        Add
      </Button>

      <div className="addresses__cards">
        {addresses.map((address) => (
          <div key={address.id} className="address temphire-elevated">
            <div className="address__header">{address.addressType?.displayName}</div>

            <div className="address__body">
              <div className="address__fields">
                <label htmlFor={`address1-${address.id}`}>Address 1:</label>
                <EntityTextInput
                  id={`address1-${address.id}`}
                  entity={address}
                  property="address1"
                  readOnly={readOnly}
                />

                <label htmlFor={`address2-${address.id}`}>Address 2:</label>
                <EntityTextInput
                  id={`address2-${address.id}`}
                  entity={address}
                  property="address2"
                  readOnly={readOnly}
                />

                <label htmlFor={`city-${address.id}`}>City:</label>
                <EntityTextInput
                  id={`city-${address.id}`}
                  entity={address}
                  property="city"
                  readOnly={readOnly}
                />

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

              <div className="address__actions">
                <Radio
                  name="primary-address"
                  label="Primary"
                  checked={address.primary}
                  disabled={!canSetPrimary(address)}
                  onChange={() => staffingResource.setPrimaryAddress(address)}
                />

                <Button
                  size="xs"
                  color="red"
                  variant="outline"
                  disabled={!canDelete(address)}
                  onClick={() => staffingResource.deleteAddress(address)}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
