import { IconMapPin, IconPencil, IconPhone } from '@tabler/icons-react';

import { useUnitOfWork } from '../core/hooks/use-unit-of-work';
import { DialogCancelledError, openDialog } from '../core/services/dialog.service';
import { showError } from '../core/services/error-handler';
import { EntityTextarea } from '../core/validation/EntityFields';
import type { SectionProps } from './ResourceDetail';
import { ResourceName, ResourceNameEditor } from './ResourceNameEditor';
import './ResourceSummary.css';

/**
 * The resource's name, large, over a free-text summary box, heading a card with an initials avatar
 * and the primary city and phone number.  In edit mode, the name opens the name editor.
 *
 * Port of the Angular client's `resource-mgt/resource-summary.component.ts` (and before it of
 * `StaffingResourceSummaryViewModel.cs`).
 *
 * The name, initials and primary address are read straight off the entity on every render;
 * `useUnitOfWork` makes this component render again when any of them changes.  (Angular re-read
 * them on every change detection pass, because they are not signals.)
 */
export function ResourceSummary({ staffingResource, readOnly, unitOfWork }: SectionProps) {
  useUnitOfWork(unitOfWork);

  const initials =
    `${staffingResource.firstName?.charAt(0) ?? ''}${staffingResource.lastName?.charAt(0) ?? ''}`.toUpperCase();
  const address = staffingResource.primaryAddress;
  const phone = staffingResource.primaryPhoneNumber;

  /** Port of `StaffingResourceSummaryViewModel.EditName`. */
  async function editName(): Promise<void> {
    if (readOnly) {
      return;
    }

    try {
      const name = await openDialog<ResourceName>(
        (close) => (
          <ResourceNameEditor
            name={{
              firstName: staffingResource.firstName ?? '',
              middleName: staffingResource.middleName ?? '',
              lastName: staffingResource.lastName ?? '',
            }}
            onClose={close}
          />
        ),
        { title: 'Edit name', size: '26rem' },
      );

      // Writing to a prop: React's rules assume props are immutable, and its lint rule says so.  A
      // Breeze entity is mutable on purpose - it tracks its own changes - and React hears about
      // them through `useUnitOfWork`, so this is how entities are edited.  See
      // docs/REACT-FOR-ANGULAR-DEVELOPERS.md, "Breeze entities and React's immutability".
      /* eslint-disable react-hooks/immutability */
      staffingResource.firstName = name.firstName;
      staffingResource.middleName = name.middleName;
      staffingResource.lastName = name.lastName;
      /* eslint-enable react-hooks/immutability */
    } catch (error) {
      if (!(error instanceof DialogCancelledError)) {
        showError(error);
      }
    }
  }

  return (
    <div className="summary temphire-card">
      <div className="summary__header">
        <span className="summary__avatar temphire-orb" aria-hidden="true">
          {initials}
        </span>

        <div className="summary__identity">
          <button
            type="button"
            className={`summary__name${readOnly ? '' : ' summary__name--editable'}`}
            disabled={readOnly}
            title={readOnly ? '' : 'Edit the name'}
            onClick={() => void editName()}
          >
            {staffingResource.fullName}
            {!readOnly && <IconPencil className="summary__edit" size={16} aria-hidden="true" />}
          </button>

          <div className="summary__facts">
            {address && (
              <span className="summary__fact">
                <IconMapPin size={14} aria-hidden="true" />
                {address.city}
                {address.state?.shortName ? `, ${address.state.shortName}` : ''}
              </span>
            )}
            {phone && (
              <span className="summary__fact">
                <IconPhone size={14} aria-hidden="true" />({phone.areaCode}) {phone.number}
              </span>
            )}
          </div>
        </div>
      </div>

      <EntityTextarea
        className="summary__text"
        entity={staffingResource}
        property="summary"
        readOnly={readOnly}
        rows={3}
        placeholder="Summary"
        aria-label="Summary"
      />
    </div>
  );
}
