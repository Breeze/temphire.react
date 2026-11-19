import { ModelValidationMetadataMap, createValidationService } from '@ideablade/validation';
import {
  breezeEntityStore,
  breezeModelType,
  breezeValidator,
  installBreezeValidators,
} from '@ideablade/validation/breeze';
import { ValidationForm, ValidationProvider } from '@ideablade/validation/react';
import { act, fireEvent, screen } from '@testing-library/react';
import { Entity } from 'breeze-client';

import rules from '../../../../../server/TempHire.Server/Validation/validation.metadata.json';
import { newTestManager, renderWithMantine } from '../../../test-utils';
import { displayNameMetadata, setDisplayNames } from '../model-display-names';
import { clientValidationMetadata } from './client-validation-metadata';
import { EntitySelect, EntityTextInput } from './EntityFields';

/**
 * Entity fields as the app builds them: `ValidationForm` over a Breeze entity, with the app's
 * validation setup.  Breeze's own rules (`'City' is required`, from `[Required]`) and the server's
 * validation metadata (`'State' is required`) reach the input the same way, as `ValidationError`s.
 * Counterpart of the Angular client's `core/validation/entity-fields.spec.ts`.
 */
describe('entity fields', () => {
  function render() {
    const manager = newTestManager();
    const metadataStore = manager.metadataStore;
    setDisplayNames(metadataStore);
    const serverRules = Object.fromEntries(
      Object.entries(rules).filter(([key]) => !key.startsWith('$')),
    ) as ModelValidationMetadataMap;

    // The service a unit of work's components see: its entity store is the manager's entities.
    const service = createValidationService({
      metadata: [clientValidationMetadata, serverRules, displayNameMetadata(metadataStore)],
      validators: [breezeValidator],
      modelTypeResolvers: [breezeModelType],
      entityStore: breezeEntityStore(manager),
    });
    installBreezeValidators(metadataStore, service);

    const address = manager.createEntity('Address', {
      id: crypto.randomUUID(),
      city: '',
      stateId: '00000000-0000-0000-0000-000000000000',
    }) as Entity & { city: string; stateId: string };

    renderWithMantine(
      <ValidationProvider service={service}>
        <ValidationForm model={address}>
          <EntityTextInput entity={address} property="city" aria-label="City" />
          <EntitySelect entity={address} property="stateId" aria-label="State" data={[]} />
        </ValidationForm>
      </ValidationProvider>,
    );
    return {
      address,
      city: screen.getByLabelText('City') as HTMLInputElement,
      // Mantine labels the select's option list too.
      state: screen
        .getAllByLabelText('State')
        .find((e) => e.tagName === 'INPUT') as HTMLInputElement,
    };
  }

  it("shows Breeze's rules and the server's rules the same way", () => {
    const { city, state } = render();

    expect(city).toHaveAttribute('aria-invalid', 'true');
    expect(city.title).toBe("'City' is required");
    expect(state.title).toBe("'State' is required");
  });

  it('writes what the user types to the entity, and clears the error', () => {
    const { address, city } = render();

    fireEvent.change(city, { target: { value: 'Seattle' } });

    expect(address.getProperty('city')).toBe('Seattle');
    expect(city).not.toHaveAttribute('aria-invalid');
    expect(city.value).toBe('Seattle');
  });

  it('shows an error after a change made outside the input', () => {
    const { address, city } = render();
    fireEvent.change(city, { target: { value: 'Seattle' } });
    expect(city).not.toHaveAttribute('aria-invalid');

    // Change the entity behind the input's back; the entity store reports it.  `act` tells React
    // that state is about to change outside an event, so it renders before we look.
    act(() => address.setProperty('city', ''));

    expect(city).toHaveAttribute('aria-invalid', 'true');
  });
});
