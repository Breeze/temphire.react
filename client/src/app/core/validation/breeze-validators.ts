import { DataProperty, ValidationError } from 'breeze-client';

/**
 * The messages of the Breeze validators of `property` that `value` fails; empty when it passes.
 *
 * Port of the Angular client's `core/validation/breeze-validators.ts`, which plugged the same
 * validators into a Signal Form (`validateWithBreeze`).  React has no forms module of its own; the
 * name editor uses Mantine's `useForm`, whose `validate` option takes one function per field that
 * returns an error message or null.  `breezeValidate` builds such a function from an entity
 * property, so a form whose values are bound for an entity that does not exist yet - the name
 * entered before a `StaffingResource` is created - applies the same rules the entity will: the
 * validators Breeze built from the server's `[Required]` and `[StringLength]` attributes.
 */
export function breezeErrors(property: DataProperty, value: unknown): string[] {
  return property.validators
    .map((validator) => validator.validate(value, { property, propertyName: property.name }))
    .filter((error): error is ValidationError => !!error)
    .map((error) => error.errorMessage);
}

/** A Mantine `useForm` validation rule from an entity property's Breeze validators. */
export function breezeValidate(property: DataProperty): (value: unknown) => string | null {
  return (value) => breezeErrors(property, value)[0] ?? null;
}
