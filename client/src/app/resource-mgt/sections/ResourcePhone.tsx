import { ValidationForm, useValidationService } from 'ideablade-validation/react';
import { Button, Radio } from '@mantine/core';

import type { PhoneNumber, StaffingResource } from '../../core/model';
import { formatPhoneNumber } from '../../core/model/phone-number';
import { useUnitOfWork } from '../../core/hooks/use-unit-of-work';
import type { ResourceMgtUnitOfWork } from '../../core/services/resource-mgt-unit-of-work';
import { EntityTextInput } from '../../core/validation/EntityFields';
import './ResourcePhone.css';

/**
 * Writes the formatted number to the entity, which stays the source of truth.  Outside the
 * component, as `EntityFields` writes its fields: the React Compiler's rules treat props as values
 * not to change, and this runs in an event handler, not during render.
 */
function writeNumber(phoneNumber: PhoneNumber, value: string): void {
  phoneNumber.number = value;
}

/**
 * One phone number card: its type, the number, the primary flag and Delete.
 *
 * Port of the Angular client's `resource-mgt/sections/resource-phone.component.ts` (and before it
 * of `StaffingResourcePhoneItemViewModel.cs`), the same shape as the address card (`ResourceAddress`).
 * The area code is part of the number, which is rewritten as `(206) 555-1234` when the user leaves
 * the field (`formatNumber`).  `useUnitOfWork` renders the card again for changes made outside it.
 */
export function ResourcePhone({
  phoneNumber,
  staffingResource,
  readOnly,
  unitOfWork,
}: {
  phoneNumber: PhoneNumber;
  staffingResource: StaffingResource;
  readOnly: boolean;
  unitOfWork: ResourceMgtUnitOfWork;
}) {
  useUnitOfWork(unitOfWork);
  const validationService = useValidationService();

  /**
   * Port of `StaffingResourcePhoneItemViewModel.CanDelete`, without its "not the primary one, not
   * the last one" condition, as for the addresses.
   */
  const canDelete = !readOnly;

  /** Port of `StaffingResourcePhoneItemViewModel.CanSetPrimary`. */
  const canSetPrimary = !readOnly && !phoneNumber.primary;

  /**
   * Rewrites the number as `(206) 555-1234` when the user leaves the field, if it is valid: if the
   * field's own rules pass, checked now rather than read from the store's validation, which can be
   * a tick behind the last keystroke.  An invalid number stays as typed, for the user to correct.
   */
  function formatNumber(): void {
    if (readOnly) {
      return;
    }

    const errors = validationService.validateModelSync(phoneNumber, 'PhoneNumber', {
      predicate: (_validator, property) => property?.propertyName === 'number',
    });
    const formatted = errors.length ? undefined : formatPhoneNumber(phoneNumber.number);
    if (formatted && formatted !== phoneNumber.number) {
      writeNumber(phoneNumber, formatted);
    }
  }

  return (
    <div className="phone temphire-elevated">
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
          onBlur={formatNumber}
        />
      </ValidationForm>
      <Radio
        name="primary-phone-number"
        label="Primary"
        checked={phoneNumber.primary}
        disabled={!canSetPrimary}
        onChange={() => staffingResource.setPrimaryPhoneNumber(phoneNumber)}
      />
      <Button
        size="xs"
        color="red"
        variant="outline"
        disabled={!canDelete}
        onClick={() => staffingResource.deletePhoneNumber(phoneNumber)}
      >
        Delete
      </Button>
    </div>
  );
}
