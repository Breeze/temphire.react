import { useEntityStoreValidation, useShownErrors } from 'ideablade-validation/react';
import { Alert, Button } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';

import type { AddressType } from '../../core/model';
import { useUnitOfWork } from '../../core/hooks/use-unit-of-work';
import { openDialog } from '../../core/services/dialog.service';
import { ItemSelector } from '../ItemSelector';
import type { SectionProps } from '../ResourceDetail';
import { ResourceAddress } from './ResourceAddress';
import './ResourceAddressList.css';

/**
 * The resource's addresses, one card each (`ResourceAddress`), with an Add button above them and
 * the resource's "at least one address" rule when it is broken.
 *
 * Port of the Angular client's `resource-mgt/sections/resource-address-list.component.ts` (and
 * before it of `StaffingResourceAddressListViewModel.cs`).
 *
 * `useUnitOfWork` re-renders this list whenever an entity in the unit of work changes: Breeze
 * changes `staffingResource.addresses` in place when an address is added or deleted, which React
 * could not see otherwise.  (Angular: a `computed` that read `unitOfWork().changes()`.)
 */
export function ResourceAddressList({ staffingResource, readOnly, unitOfWork }: SectionProps) {
  useUnitOfWork(unitOfWork);

  const addresses = [...staffingResource.addresses];

  /**
   * The resource's "at least one address" rule, when it is broken.  It is a rule of the validation
   * metadata about the whole resource, so no field shows it.  It comes from the continuous
   * validation of the route's unit of work, which the Save button reacts to too (`ResourceMgt`):
   * the route's validation service shares it.
   */
  const validation = useEntityStoreValidation();
  // On a new resource, the rule is broken from the start: it shows once the user breaks it again
  // (deletes the last address) or tries to save.  See `ErrorVisibility` in `ResourceMgt`.
  const ruleErrors = useShownErrors(
    staffingResource,
    (validation?.validationErrors ?? []).filter(
      (error) => error.model === staffingResource && error.id === 'ADDRESS_REQUIRED',
    ),
  );

  /** Port of `StaffingResourceAddressListViewModel.Add`: pick a type, then create the address. */
  async function add(): Promise<void> {
    if (readOnly) {
      return;
    }

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
    if (!addressType) {
      return; // cancelled
    }
    staffingResource.addAddress(addressType);
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

      {ruleErrors.map((error) => (
        <Alert key={error.key} color="red" variant="light" p="xs">
          {error.errorMessage}
        </Alert>
      ))}

      <div className="addresses__cards">
        {addresses.map((address) => (
          <ResourceAddress
            key={address.id}
            address={address}
            staffingResource={staffingResource}
            readOnly={readOnly}
            unitOfWork={unitOfWork}
          />
        ))}
      </div>
    </div>
  );
}
