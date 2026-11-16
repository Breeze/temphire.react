import { Button, Radio } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';

import { PhoneNumber, PhoneNumberType } from '../../core/model';
import { useUnitOfWork } from '../../core/hooks/use-unit-of-work';
import { DialogCancelledError, openDialog } from '../../core/services/dialog.service';
import { showError } from '../../core/services/error-handler';
import { EntityTextInput } from '../../core/validation/EntityFields';
import { ItemSelector } from '../ItemSelector';
import type { SectionProps } from '../ResourceDetail';
import './ResourcePhoneList.css';

/**
 * One card per phone number - type, area code, number, primary flag, Delete - and an Add button.
 *
 * Port of the Angular client's `resource-mgt/sections/resource-phone-list.component.ts` (and before
 * it of `StaffingResourcePhoneListViewModel.cs` + `StaffingResourcePhoneItemViewModel.cs`).
 */
export function ResourcePhoneList({ staffingResource, readOnly, unitOfWork }: SectionProps) {
  useUnitOfWork(unitOfWork);

  const phoneNumbers = [...staffingResource.phoneNumbers];

  /** Port of `StaffingResourcePhoneItemViewModel.CanDelete`. */
  const canDelete = (phoneNumber: PhoneNumber) =>
    !readOnly && !phoneNumber.primary && staffingResource.phoneNumbers.length > 1;

  /** Port of `StaffingResourcePhoneItemViewModel.CanSetPrimary`. */
  const canSetPrimary = (phoneNumber: PhoneNumber) => !readOnly && !phoneNumber.primary;

  /**
   * Port of `StaffingResourcePhoneListViewModel.Add`.  Phone number types have no `displayName`, so
   * the original selected on `Name` here where the address list used `DisplayName`.
   */
  async function add(): Promise<void> {
    if (readOnly) {
      return;
    }

    try {
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
      staffingResource.addPhoneNumber(type);
    } catch (error) {
      if (!(error instanceof DialogCancelledError)) {
        showError(error);
      }
    }
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

      <div className="phones__cards">
        {phoneNumbers.map((phoneNumber) => (
          <div key={phoneNumber.id} className="phone temphire-elevated">
            <span className="phone__type">{phoneNumber.phoneNumberType?.name}</span>
            <EntityTextInput
              className="phone__area-code"
              aria-label="Area code"
              entity={phoneNumber}
              property="areaCode"
              readOnly={readOnly}
            />
            <EntityTextInput
              className="phone__number"
              aria-label="Number"
              entity={phoneNumber}
              property="number"
              readOnly={readOnly}
            />
            <Radio
              name="primary-phone-number"
              label="Primary"
              checked={phoneNumber.primary}
              disabled={!canSetPrimary(phoneNumber)}
              onChange={() => staffingResource.setPrimaryPhoneNumber(phoneNumber)}
            />
            <Button
              size="xs"
              color="red"
              variant="outline"
              disabled={!canDelete(phoneNumber)}
              onClick={() => staffingResource.deletePhoneNumber(phoneNumber)}
            >
              Delete
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
