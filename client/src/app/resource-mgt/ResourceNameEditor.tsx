import { useValidationService } from 'ideablade-validation/react';
import { Button, Group, Stack, TextInput } from '@mantine/core';
import { FormErrors, useForm } from '@mantine/form';

import { CloseDialog } from '../core/services/dialog.service';

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
 * applies the `ResourceName` validation metadata (`clientValidationMetadata`), whose properties
 * inherit `StaffingResource`'s with `from`: first and last name required, and at most 100
 * characters each, from `[Required]` / `[StringLength]` on the server's model, which Breeze
 * carries.  `useForm`'s `validate` function hands the values to the validation service and files
 * each error under the fields it names (`propertyNames`).  Errors show once the user has left a field (`validateInputOnBlur`), as the Angular form
 * showed them once a field was touched.
 */
export function ResourceNameEditor({ name, onClose }: ResourceNameEditorProps) {
  const validation = useValidationService();

  const form = useForm<ResourceName>({
    initialValues: { firstName: '', middleName: '', lastName: '', ...name },
    validate: (values) => {
      const errors: FormErrors = {};
      for (const error of validation.validateModelSync(values, 'ResourceName')) {
        for (const property of error.propertyNames) {
          errors[property] ??= error.errorMessage;
        }
      }
      return errors;
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
