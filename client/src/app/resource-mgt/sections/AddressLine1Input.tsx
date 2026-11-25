import { useFieldValidation } from 'ideablade-validation/react';
import { Autocomplete } from '@mantine/core';
import { useEffect, useRef, useState } from 'react';

import type { Address } from '../../core/model';
import {
  type AddressSuggestions,
  fillAddress,
  noAddressSuggestions,
  suggestAddresses,
} from '../../core/services/address-suggestions';
import { errorProps } from '../../core/validation/EntityFields';

/** How long the user's typing must pause before the suggestions are asked for, as in Angular. */
const DELAY_MS = 300;

/** The fewest characters worth asking about; the server asks for no fewer. */
const MIN_LENGTH = 3;

/**
 * Writes what the user typed to the entity, which stays the source of truth.  Outside the
 * component, as `EntityFields` writes its fields: the React Compiler treats props as values not to
 * change during render, and the entity is changed in an event handler, not during render.
 */
function writeAddress1(address: Address, value: string): void {
  address.address1 = value;
}

/**
 * Address 1, with address completion: as the user types, it suggests U.S. addresses that start that
 * way, and picking one fills the address form (`fillAddress`).
 *
 * Port of the Angular client's `p-autocomplete` in `resource-address-list.component.ts`.  Mantine's
 * `Autocomplete` shows the suggestions; this asks for them after a pause in the typing, keeps only
 * the answer to the latest text, and shows the data's credit under the field while there are some.
 * Like `EntityTextInput`, it writes what the user types to the entity and reports its touches.
 */
export function AddressLine1Input({
  id,
  address,
  stateIds,
  readOnly,
}: {
  id: string;
  address: Address;
  /** The states the app has, so a suggestion's state can be checked against them. */
  stateIds: readonly string[];
  readOnly: boolean;
}) {
  const field = useFieldValidation('address1');
  const [found, setFound] = useState<AddressSuggestions>(noAddressSuggestions);
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function typed(value: string): void {
    // Picking a suggestion reports its label as the value too: that one is `picked`'s to handle.
    if (found.suggestions.some((suggestion) => suggestion.label === value)) {
      return;
    }

    writeAddress1(address, value);
    field.markTouched();

    window.clearTimeout(timer.current);
    const request = ++latest.current;
    const text = value.trim();
    if (readOnly || text.length < MIN_LENGTH) {
      setFound(noAddressSuggestions);
      return;
    }

    timer.current = window.setTimeout(async () => {
      const result = await suggestAddresses(text);
      if (request === latest.current) {
        setFound(result);
      }
    }, DELAY_MS);
  }

  function picked(label: string): void {
    const suggestion = found.suggestions.find((s) => s.label === label);
    if (suggestion) {
      fillAddress(address, suggestion, stateIds);
      field.markTouched();
      // Done with these, and with their credit.  Mantine reports the label as the new value in the
      // same event; `typed` still sees these suggestions then, and leaves the label alone.
      setFound(noAddressSuggestions);
    }
  }

  return (
    <Autocomplete
      id={id}
      {...errorProps(field.message)}
      value={address.address1 ?? ''}
      onChange={typed}
      onOptionSubmit={picked}
      onBlur={field.markTouched}
      readOnly={readOnly}
      // The server has matched already; Mantine's own filter would hide what it found.
      data={[...new Set(found.suggestions.map((s) => s.label))]}
      filter={({ options }) => options}
      description={found.suggestions.length > 0 ? found.attribution : undefined}
      inputWrapperOrder={['label', 'input', 'description', 'error']}
      comboboxProps={{ withinPortal: true }}
    />
  );
}
