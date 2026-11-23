import { ValidationForm } from 'ideablade-validation/react';
import { Button } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';

import { useUnitOfWork } from '../../core/hooks/use-unit-of-work';
import { EntityTextInput } from '../../core/validation/EntityFields';
import type { SectionProps } from '../ResourceDetail';
import './ResourceSkills.css';

/**
 * A flat list of free-text skills, each a text box plus a Delete button.
 *
 * Port of the Angular client's `resource-mgt/sections/resource-skills.component.ts` (and before it
 * of `StaffingResourceSkillsViewModel.cs`).  The list is sorted on every render; because this
 * component renders again when a skill changes (`useUnitOfWork`), a renamed skill moves into place
 * - the WPF view model re-sorted on `SavedMessage`, the Angular one in a `computed`.
 */
export function ResourceSkills({ staffingResource, readOnly, unitOfWork }: SectionProps) {
  useUnitOfWork(unitOfWork);

  /** Port of the `SkillsSorted` property; a new skill has no description yet. */
  const skills = [...(staffingResource.skills ?? [])].sort((a, b) =>
    (a.description ?? '').localeCompare(b.description ?? ''),
  );

  return (
    <div className="skills">
      <div className="skills__header">
        <h3 className="temphire-section-heading">Skills:</h3>
        {!readOnly && (
          <Button
            size="xs"
            variant="outline"
            leftSection={<IconPlus size={14} />}
            onClick={() => staffingResource.addSkill()}
          >
            Add
          </Button>
        )}
      </div>

      {skills.length === 0 ? (
        <p className="skills__empty">
          No skills found. Please add a skill by clicking the 'Add' button.
        </p>
      ) : (
        <div className="skills__list">
          {skills.map((skill) => (
            <ValidationForm key={skill.id} model={skill}>
              <div className="skills__row">
                <EntityTextInput
                  className="skills__input"
                  aria-label="Skill"
                  entity={skill}
                  property="description"
                  readOnly={readOnly}
                />
                <Button
                  size="xs"
                  color="red"
                  variant="subtle"
                  disabled={readOnly}
                  onClick={() => staffingResource.deleteSkill(skill)}
                >
                  Delete
                </Button>
              </div>
            </ValidationForm>
          ))}
        </div>
      )}
    </div>
  );
}
