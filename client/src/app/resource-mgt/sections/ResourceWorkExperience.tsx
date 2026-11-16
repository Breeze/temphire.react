import { Button, Divider } from '@mantine/core';
import { IconCalendar, IconPlus } from '@tabler/icons-react';
import { Fragment } from 'react';

import { useUnitOfWork } from '../../core/hooks/use-unit-of-work';
import {
  EntityDateInput,
  EntityTextInput,
  EntityTextarea,
} from '../../core/validation/EntityFields';
import type { SectionProps } from '../ResourceDetail';
import './ResourceWorkExperience.css';

/** `from` is non-nullable in the model, but a half-filled new row can still hold nothing yet. */
function timeOf(value: Date | null | undefined): number {
  return value ? new Date(value).getTime() : 0;
}

/**
 * The resource's work history, most recent first: dates, title, location, company and description.
 *
 * Port of the Angular client's `resource-mgt/sections/resource-work-experience.component.ts` (and
 * before it of `StaffingResourceWorkExperienceViewModel.cs`).
 */
export function ResourceWorkExperience({ staffingResource, readOnly, unitOfWork }: SectionProps) {
  useUnitOfWork(unitOfWork);

  /** The `WorkExperienceSorted` property, flipped to most-recent-first. */
  const items = [...(staffingResource.workExperience ?? [])].sort(
    (a, b) => timeOf(b.from) - timeOf(a.from),
  );

  return (
    <div className="work">
      <div className="work__header">
        <h3 className="temphire-section-heading">Work Experience:</h3>
        {!readOnly && (
          <Button
            size="xs"
            variant="outline"
            leftSection={<IconPlus size={14} />}
            onClick={() => staffingResource.addWorkExperience()}
          >
            Add
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="work__empty">
          No work experience found. Please add work experience by clicking the 'Add' button.
        </p>
      ) : (
        // `Fragment` with a key: a list item that renders two siblings (the item, and the divider
        // after it) still needs one key for the pair.
        items.map((item, index) => (
          <Fragment key={item.id}>
            <div className="work__item">
              <div className="work__row">
                <label className="work__field work__field--date">
                  <span className="work__label">From:</span>
                  <EntityDateInput
                    entity={item}
                    property="from"
                    disabled={readOnly}
                    valueFormat="MM/DD/YYYY"
                    rightSection={<IconCalendar size={16} />}
                  />
                </label>
                <label className="work__field work__field--date">
                  <span className="work__label">To:</span>
                  <EntityDateInput
                    entity={item}
                    property="to"
                    disabled={readOnly}
                    valueFormat="MM/DD/YYYY"
                    rightSection={<IconCalendar size={16} />}
                  />
                </label>
                <label className="work__field work__field--grow">
                  <span className="work__label">Title:</span>
                  <EntityTextInput entity={item} property="positionTitle" readOnly={readOnly} />
                </label>
                <label className="work__field work__field--location">
                  <span className="work__label">Location:</span>
                  <EntityTextInput entity={item} property="location" readOnly={readOnly} />
                </label>
                <div className="work__field work__field--action">
                  <Button
                    size="xs"
                    color="red"
                    variant="subtle"
                    disabled={readOnly}
                    onClick={() => staffingResource.deleteWorkExperience(item)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
              <label className="work__field">
                <span className="work__label">Company:</span>
                <EntityTextInput entity={item} property="company" readOnly={readOnly} />
              </label>
              <label className="work__field">
                <span className="work__label">Description:</span>
                <EntityTextarea entity={item} property="description" readOnly={readOnly} rows={4} />
              </label>
            </div>
            {index < items.length - 1 && <Divider my="sm" />}
          </Fragment>
        ))
      )}
    </div>
  );
}
