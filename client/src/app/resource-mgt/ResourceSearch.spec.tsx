import { act, fireEvent, screen, waitFor } from '@testing-library/react';

import { StaffingResourceListItem } from '../core/projections/staffing-resource-list-item';
import { AppServices, AppServicesProvider } from '../core/services/app-services';
import { renderWithMantine } from '../../test-utils';
import { ResourceSearch } from './ResourceSearch';

/**
 * The search box: an emptied box shows the full list again, and there is no Clear button.  Port
 * of the "the search box" tests in the Angular client's `resource-search.component.spec.ts`, plus
 * tests for the clear button in the box (Mantine hides the browser's own X).
 *
 * The original's `CanSearch` / `CanClear` both required text in the box.  So once the user emptied
 * it after a search (the X in it, or deleting the text), both buttons were disabled and the full
 * list could only come back by typing something and clicking Clear.
 */
describe('ResourceSearch', () => {
  const rows = ['Ann', 'Ben', 'Cal'].map(
    (name, i) => ({ id: `id-${i}`, fullName: name }) as StaffingResourceListItem,
  );

  /** The text of every search the grid ran. */
  let searches: string[];

  function setUp() {
    searches = [];
    const unitOfWorkManager = {
      subscribe: () => () => undefined,
      saves: () => 0,
      get: () => ({
        search: {
          simple: async (text: string) => {
            searches.push(text);
            return rows;
          },
        },
      }),
    };
    renderWithMantine(
      <AppServicesProvider services={{ unitOfWorkManager } as unknown as AppServices}>
        <ResourceSearch selectedId="id-1" onSelectionChange={() => undefined} />
      </AppServicesProvider>,
    );
    const box = screen.getByLabelText('Search staffing resources');
    const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;
    /** Types into the search box: `value` replaces its text, as the X or deleting it would. */
    const type = (value: string) => act(() => fireEvent.change(box, { target: { value } }));
    const press = (name: string) => act(() => fireEvent.click(button(name)));
    return { button, type, press };
  }

  it('shows the full list again when the box is emptied after a search', async () => {
    const { type, press } = setUp();
    await waitFor(() => expect(searches).toEqual(['']));

    await type('Cal');
    await press('Search');
    await waitFor(() => expect(searches).toEqual(['', 'Cal']));

    // Deleting the text.
    await type('');
    await waitFor(() => expect(searches).toEqual(['', 'Cal', '']));
  });

  it('does not search again when the box is emptied while nothing is filtered', async () => {
    const { type } = setUp();
    await waitFor(() => expect(searches).toEqual(['']));
    await type('Cal');
    await type('');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(searches).toEqual(['']);
  });

  it('runs an empty search, which lists everyone', async () => {
    const { button, press } = setUp();
    await waitFor(() => expect(searches).toEqual(['']));
    expect(button('Search').disabled).toBe(false);
    await press('Search');
    await waitFor(() => expect(searches).toEqual(['', '']));
  });

  it('has no Clear button', () => {
    setUp();
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
  });

  describe('the clear button in the box', () => {
    const clearButton = () => screen.queryByRole('button', { name: 'Clear search' });

    it('is there only while the box has text', async () => {
      const { type } = setUp();
      expect(clearButton()).toBeNull();
      await type('Cal');
      expect(clearButton()).not.toBeNull();
      await type('');
      expect(clearButton()).toBeNull();
    });

    it('empties the box and shows the full list again after a search', async () => {
      const { type, press } = setUp();
      await type('Cal');
      await press('Search');
      await waitFor(() => expect(searches).toEqual(['', 'Cal']));

      await act(() => fireEvent.click(clearButton()!));
      await waitFor(() => expect(searches).toEqual(['', 'Cal', '']));
      const box = screen.getByLabelText('Search staffing resources') as HTMLInputElement;
      expect(box.value).toBe('');
      expect(document.activeElement).toBe(box);
    });

    it('only empties the box while nothing is filtered', async () => {
      const { type } = setUp();
      await waitFor(() => expect(searches).toEqual(['']));
      await type('Cal');
      await act(() => fireEvent.click(clearButton()!));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(searches).toEqual(['']);
      expect((screen.getByLabelText('Search staffing resources') as HTMLInputElement).value).toBe(
        '',
      );
    });
  });
});
