import { ValidationForm, useEntityStoreValidation, useShownErrors, useValidationService } from 'ideablade-validation/react';
import { Alert, Button, Radio } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';

import { PhoneNumber, PhoneNumberType } from '../../core/model';
import { formatPhoneNumber } from '../../core/model/phone-number';
import { useUnitOfWork } from '../../core/hooks/use-unit-of-work';
import { openDialog } from '../../core/services/dialog.service';
import { EntityTextInput } from '../../core/validation/EntityFields';
import { ItemSelector } from '../ItemSelector';
import type { SectionProps } from '../ResourceDetail';
import './ResourcePhoneList.css';

/**
 * One card per phone number - type, number, primary flag, Delete - and an Add button.  The area
 * code is part of the number, which is rewritten as `(206) 555-1234` when the user leaves the field
 * (`formatNumber`).
 *
 * Port of the Angular client's `resource-mgt/sections/resource-phone-list.component.ts` (and before
 * it of `StaffingResourcePhoneListViewModel.cs` + `StaffingResourcePhoneItemViewModel.cs`).
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
   * Port of `StaffingResourcePhoneItemViewModel.CanDelete`, without its "not the primary one, not
   * the last one" condition, as in the address list.
   */
  const canDelete = (_phoneNumber: PhoneNumber) => !readOnly;

  const validationService = useValidationService();

  /**
   * Rewrites the number as `(206) 555-1234` when the user leaves the field, if it is valid: if the
   * field's own rules pass, checked now rather than read from the store's validation, which can be
   * a tick behind the last keystroke.  An invalid number stays as typed, for the user to correct.
   */
  function formatNumber(phoneNumber: PhoneNumber): void {
    if (readOnly) {
      return;
    }

    const errors = validationService.validateModelSync(phoneNumber, 'PhoneNumber', {
      predicate: (_validator, property) => property?.propertyName === 'number',
    });
    const formatted = errors.length ? undefined : formatPhoneNumber(phoneNumber.number);
    if (formatted && formatted !== phoneNumber.number) {
      phoneNumber.number = formatted;
    }
  }

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
          <div key={phoneNumber.id} className="phone temphire-elevated">
            <span className="phone__type">{phoneNumber.phoneNumberType?.name}</span>
            <ValidationForm model={phoneNumber}>
              <EntityTextInput
                className="phone__number"
                aria-label="Phone number"
                type="tel"
                placeholder="(206) 555-1234"
                entity={phoneNumber}
                property="number"
                readOnly={readOnly}
                onBlur={() => formatNumber(phoneNumber)}
              />
            </ValidationForm>
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
