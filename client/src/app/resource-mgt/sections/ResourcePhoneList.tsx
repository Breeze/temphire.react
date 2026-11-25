import { useEntityStoreValidation, useShownErrors } from 'ideablade-validation/react';
import { Alert, Button } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';

import type { PhoneNumberType } from '../../core/model';
import { useUnitOfWork } from '../../core/hooks/use-unit-of-work';
import { openDialog } from '../../core/services/dialog.service';
import { ItemSelector } from '../ItemSelector';
import type { SectionProps } from '../ResourceDetail';
import { ResourcePhone } from './ResourcePhone';
import './ResourcePhoneList.css';

/**
 * The resource's phone numbers, one card each (`ResourcePhone`), with an Add button above them and
 * the resource's "at least one phone number" rule when it is broken.
 *
 * Port of the Angular client's `resource-mgt/sections/resource-phone-list.component.ts` (and before
 * it of `StaffingResourcePhoneListViewModel.cs`).
 */
export function ResourcePhoneList({ staffingResource, readOnly, unitOfWork }: SectionProps) {
  useUnitOfWork(unitOfWork);

  const phoneNumbers = [...staffingResource.phoneNumbers];

  /** The resource's "at least one phone number" rule, when it is broken; see the address list. */
  const validation = useEntityStoreValidation();
  // On a new resource, the rule is broken from the start: it shows once the user breaks it again
  // (deletes the last phone number) or tries to save.  See `ErrorVisibility` in `ResourceMgt`.
  const ruleErrors = useShownErrors(
    staffingResource,
    (validation?.validationErrors ?? []).filter(
      (error) => error.model === staffingResource && error.id === 'PHONE_NUMBER_REQUIRED',
    ),
  );

  /**
   * Port of `StaffingResourcePhoneListViewModel.Add`.  Phone number types have no `displayName`, so
   * the original selected on `Name` here where the address list used `DisplayName`.
   */
  async function add(): Promise<void> {
    if (readOnly) {
      return;
    }

    const type = await openDialog<PhoneNumberType>(
      (close) => (
        <ItemSelector
          prompt="Select type:"
          items={unitOfWork.phoneNumberTypes.allInCache('name')}
          label={(item) => item.name}
          onClose={close}
        />
      ),
      { title: 'Add a phone number', size: '24rem' },
    );
    if (!type) {
      return; // cancelled
    }
    staffingResource.addPhoneNumber(type);
  }

  return (
    <div className="phones">
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

      <div className="phones__cards">
        {phoneNumbers.map((phoneNumber) => (
          <ResourcePhone
            key={phoneNumber.id}
            phoneNumber={phoneNumber}
            staffingResource={staffingResource}
            readOnly={readOnly}
            unitOfWork={unitOfWork}
          />
        ))}
      </div>
    </div>
  );
}
