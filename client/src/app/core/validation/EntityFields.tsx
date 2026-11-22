import {
  NumberInput,
  NumberInputProps,
  Select,
  SelectProps,
  TextInput,
  TextInputProps,
  Textarea,
  TextareaProps,
} from '@mantine/core';
import { DateInput, DateInputProps } from '@mantine/dates';
import { useFieldValidation } from '@ideablade/validation/react';
import { Entity } from 'breeze-client';

/**
 * Inputs bound to one property of a Breeze entity, showing that property's validation errors.
 *
 * New in the React port; they take the place of `[(ngModel)]="address.city"` in a form that
 * validates the entity with `@ideablade/validation` (`<form ngForm [validationModel]="address">`
 * in the Angular client):
 *
 * ```html
 * <form ngForm [validationModel]="address">
 *   <input pInputText name="city" [(ngModel)]="address.city" #city="ngModel" [invalid]="city.invalid" />
 * </form>
 * ```
 *
 * becomes
 *
 * ```tsx
 * <ValidationForm model={address}>
 *   <EntityTextInput entity={address} property="city" />
 * </ValidationForm>
 * ```
 *
 * **Where the errors come from.**  `ValidationForm` validates the entity as a whole with the
 * validation metadata, and each input shows the errors about its property (`useFieldValidation`):
 * Breeze's own rules - the server's `[Required]` and `[MaxLength]`, through the `breeze`
 * validator - and the server's validation metadata alike, including a rule about the whole entity
 * that names the property.  "At least 18 years old when hired" names the date of birth and the
 * hire date, so it shows on both, and changing either checks it again.  Outside a
 * `ValidationForm`, an input shows no errors.
 *
 * **Two-way binding, React style.**  React has no `[(ngModel)]`.  An input is *controlled*: it
 * shows the `value` it is given, and reports each keystroke through `onChange`; the component
 * decides what to do with it.  Here `onChange` writes the new value straight to the entity, Breeze
 * fires `entityChanged`, the unit of work tells its subscribers (`useUnitOfWork`), and the section
 * that renders this input renders again with the new value.  So the entity stays the single source
 * of truth, as it was with `ngModel`.
 *
 * The error shows as a red border (Mantine's `error` prop) with the message on hover, as in the
 * Angular client.  Which errors show is the screen's `ErrorVisibility`'s decision (`ResourceMgt`):
 * a new entity's errors wait until the user has touched the field, caused the error, or tried to
 * save.  Each input reports its touches - an edit, or leaving it - with `markTouched`.
 */
type EntityProps<T extends Entity> = {
  entity: T;
  property: keyof T & string;
};

function read<T extends Entity>(entity: T, property: keyof T & string): unknown {
  return entity[property];
}

function write<T extends Entity>(entity: T, property: keyof T & string, value: unknown): void {
  (entity as Record<string, unknown>)[property] = value;
}

/** Mantine's props for showing an error: red border, message on hover, `aria-invalid`. */
function errorProps(message: string | null) {
  return {
    error: !!message,
    title: message ?? undefined,
    'aria-invalid': message ? true : undefined,
  };
}

export function EntityTextInput<T extends Entity>({
  entity,
  property,
  ...rest
}: EntityProps<T> & Omit<TextInputProps, 'value' | 'onChange' | 'error'>) {
  const field = useFieldValidation(property);
  return (
    <TextInput
      {...rest}
      {...errorProps(field.message)}
      onBlur={field.markTouched}
      value={(read(entity, property) as string | null) ?? ''}
      onChange={(event) => {
        write(entity, property, event.currentTarget.value);
        field.markTouched();
      }}
    />
  );
}

export function EntityTextarea<T extends Entity>({
  entity,
  property,
  ...rest
}: EntityProps<T> & Omit<TextareaProps, 'value' | 'onChange' | 'error'>) {
  const field = useFieldValidation(property);
  return (
    <Textarea
      {...rest}
      {...errorProps(field.message)}
      onBlur={field.markTouched}
      value={(read(entity, property) as string | null) ?? ''}
      onChange={(event) => {
        write(entity, property, event.currentTarget.value);
        field.markTouched();
      }}
    />
  );
}

/** A select whose value is a foreign key - `Address.stateId`, say. */
export function EntitySelect<T extends Entity>({
  entity,
  property,
  ...rest
}: EntityProps<T> & Omit<SelectProps, 'value' | 'onChange' | 'error'>) {
  const field = useFieldValidation(property);
  return (
    <Select
      {...rest}
      {...errorProps(field.message)}
      onBlur={field.markTouched}
      value={(read(entity, property) as string | null) ?? null}
      onChange={(value) => {
        write(entity, property, value);
        field.markTouched();
      }}
    />
  );
}

/** A number; an empty box sets the property to null, so a `required` rule can catch it. */
export function EntityNumberInput<T extends Entity>({
  entity,
  property,
  ...rest
}: EntityProps<T> & Omit<NumberInputProps, 'value' | 'onChange' | 'error'>) {
  const field = useFieldValidation(property);
  return (
    <NumberInput
      {...rest}
      {...errorProps(field.message)}
      onBlur={field.markTouched}
      value={(read(entity, property) as number | null) ?? ''}
      onChange={(value) => {
        write(entity, property, toNumber(value));
        field.markTouched();
      }}
    />
  );
}

/**
 * The number in what `NumberInput` reports.  It reports a number only when the text is one it
 * would not reformat: $65.00 - how a rate reads with `fixedDecimalScale` - comes as the
 * string `'65.00'`, as do `'65.'` and `'0.50'` while typing.  Those are numbers all the same; only
 * an empty box (or a lone `-`) has none.
 */
function toNumber(value: number | string): number | null {
  if (typeof value === 'number') {
    return value;
  }
  const number = value.trim() === '' ? NaN : Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * A date.  Breeze holds a `Date`; Mantine's date inputs work with `YYYY-MM-DD` strings, so the value
 * is converted both ways, as a local date (the time of day is not shown, so it is not kept).
 */
export function EntityDateInput<T extends Entity>({
  entity,
  property,
  ...rest
}: EntityProps<T> & Omit<DateInputProps, 'value' | 'onChange' | 'error'>) {
  const field = useFieldValidation(property);
  return (
    <DateInput
      {...rest}
      {...errorProps(field.message)}
      onBlur={field.markTouched}
      value={toDateString(read(entity, property) as Date | null)}
      onChange={(value) => {
        write(entity, property, value ? new Date(`${value}T00:00:00`) : null);
        field.markTouched();
      }}
    />
  );
}

function toDateString(date: Date | null | undefined): string | null {
  if (!date) {
    return null;
  }
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
