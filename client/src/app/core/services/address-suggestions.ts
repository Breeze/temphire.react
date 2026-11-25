import { environment } from '../../../environments/environment';
import type { Address } from '../model';
import { getJson } from './api-fetch';

/**
 * Port of the Angular client's `core/services/address-suggestion.service.ts`: U.S. addresses that
 * start with what the user has typed, for the address form's first line.
 *
 * The server asks Photon, a geocoder over OpenStreetMap data, so the client needs no key and knows
 * nothing of the provider (see the server README's "Address completion").  A suggestion is a
 * convenience: when the request fails, there are none, and the user goes on typing.
 */

/** An address to fill the address form with: `AddressController.Suggest` on the server. */
export interface AddressSuggestion {
  /** House number and street, or the street alone when the number isn't known. */
  address1: string;
  city?: string;
  /** The state's id among the cached states, when it is one of them. */
  stateId?: string;
  stateShortName?: string;
  zipcode?: string;
  /** The whole address on one line, for the list. */
  label: string;
}

export interface AddressSuggestions {
  /** The credit the data's licence asks for, to show with the suggestions. */
  attribution: string;
  suggestions: AddressSuggestion[];
}

export const noAddressSuggestions: AddressSuggestions = { attribution: '', suggestions: [] };

export async function suggestAddresses(text: string): Promise<AddressSuggestions> {
  try {
    return await getJson<AddressSuggestions>(`${environment.addressApiRoot}/Suggest?q=${encodeURIComponent(text)}`);
  } catch {
    return noAddressSuggestions;
  }
}

/** No state: the empty Guid a new address starts with, which the `STATE_REQUIRED` rule refuses. */
export const NO_STATE = '00000000-0000-0000-0000-000000000000';

/**
 * Fills the address with the suggestion the user picked: Address 1, City, State and Zipcode, and
 * clears any of them the suggestion doesn't know, rather than keep a value from the address that
 * was there before.  The address rules then show what is missing.  Address 2 (a unit, say) stays.
 *
 * @param stateIds the states the app has (the cached lookup); another state leaves the state empty.
 */
export function fillAddress(address: Address, suggestion: AddressSuggestion, stateIds: readonly string[]): void {
  address.address1 = suggestion.address1;
  address.city = suggestion.city ?? '';
  address.stateId = suggestion.stateId && stateIds.includes(suggestion.stateId) ? suggestion.stateId : NO_STATE;
  address.zipcode = suggestion.zipcode ?? '';
}
