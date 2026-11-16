import { Button, Group, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';

import { StaffingResource } from '../core/model';
import { useServices } from '../core/services/app-services';
import { CloseDialog } from '../core/services/dialog.service';
import { breezeValidate } from '../core/validation/breeze-validators';

export interface ResourceName {
  firstName: string;
  middleName: string;
  lastName: string;
}

interface ResourceNameEditorProps {
  /** The name to start from, when renaming. */
  name?: Partial<ResourceName>;
  onClose: CloseDialog<ResourceName>;
}

/**
 * Collects a staffing resource's name: when adding a resource, and to rename one from the summary.
 *
 * Port of the Angular client's `resource-mgt/resource-name-editor.component.ts` (and before it of
 * `StaffingResourceNameEditorViewModel.cs`).
 *
 * **Forms.**  The Angular version was a Signal Form.  React itself has no forms module - an input's
 * value is just state - so form libraries fill the gap; this uses Mantine's `useForm`, which keeps
 * the values, runs a validation function per field, and wires inputs up with `getInputProps`.
 *
 * There are still no hand-written rules here.  The names end up on a `StaffingResource`, so the form
 * applies `StaffingResource`'s own Breeze validators (`breezeValidate`): first and last name
 * required, and at most 100 characters each, from `[Required]` / `[StringLength]` on the server's
 * model.  Errors show once the user has left a field (`validateInputOnBlur`), as the Angular form
 * showed them once a field was touched.
 */
export function ResourceNameEditor({ name, onClose }: ResourceNameEditorProps) {
  const type = useServices().emProvider.metadataStore.getAsEntityType(StaffingResource);

  const form = useForm<ResourceName>({
    initialValues: { firstName: '', middleName: '', lastName: '', ...name },
    validate: {
      firstName: breezeValidate(type.getDataProperty('firstName')),
      middleName: breezeValidate(type.getDataProperty('middleName')),
      lastName: breezeValidate(type.getDataProperty('lastName')),
    },
    validateInputOnBlur: true,
  });

  const accept = (values: ResourceName) =>
    onClose({
      firstName: values.firstName.trim(),
      middleName: values.middleName?.trim() ?? '',
      lastName: values.lastName.trim(),
    });

  return (
    <form onSubmit={form.onSubmit(accept)}>
      <Stack gap="sm">
        <TextInput label="First name" data-autofocus {...form.getInputProps('firstName')} />
        <TextInput label="Middle name" {...form.getInputProps('middleName')} />
        <TextInput label="Last name" {...form.getInputProps('lastName')} />

        <Group justify="flex-end" gap="xs" mt="xs">
          <Button type="submit" disabled={!form.isValid()}>
            OK
          </Button>
          <Button variant="outline" color="gray" onClick={() => onClose(undefined)}>
            Cancel
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
