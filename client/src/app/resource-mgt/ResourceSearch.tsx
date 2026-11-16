import { Button, Loader, ScrollArea, Table, TextInput } from '@mantine/core';
import {
  Ref,
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useState,
} from 'react';

import { StaffingResourceListItem } from '../core/projections/staffing-resource-list-item';
import { useSaveCount } from '../core/hooks/use-unit-of-work';
import { useServices } from '../core/services/app-services';
import { describe } from '../core/services/error-handler';
import { SHARED_UNIT_OF_WORK_KEY } from '../core/services/unit-of-work-manager';
import './ResourceSearch.css';

/** What the parent can call on the search pane through its ref. */
export interface ResourceSearchHandle {
  /** Puts `text` in the search box and runs the search, as if the user had typed it. */
  searchFor(text: string): void;
}

interface ResourceSearchProps {
  /** Keeps the grid highlight in step with the resource the workspace has open. */
  selectedId: string | null;
  onSelectionChange: (item: StaffingResourceListItem | null) => void;
  ref?: Ref<ResourceSearchHandle>;
}

/**
 * A search box over a grid of `StaffingResourceListItem` projections.
 *
 * Port of the Angular client's `resource-mgt/resource-search.component.ts` (and before it of
 * `StaffingResourceSearchViewModel.cs`).  Two details carried over from the original:
 *
 *  - it queries through the **shared** unit of work, so it never sees a sandbox's uncommitted edits;
 *  - it re-runs the search whenever anything is saved anywhere (`IHandle<SavedMessage>`); here, the
 *    save count is a dependency of the effect that loads the results.
 *
 * **Props, and events as callback props.**  Angular's `input()`s and `output()`s are both *props*
 * in React: `selectedId` is data passed down; `onSelectionChange` is a function passed down, which
 * the child calls instead of `this.selectionChange.emit(...)`.  `ref` replaces the parent's
 * `viewChild`; `useImperativeHandle` decides what the parent sees through it.
 *
 * **Loading data.**  Angular's `resource()` loaded the results whenever its params changed.  React
 * has no built-in equivalent outside a data router; the classic pattern is an effect that depends
 * on the params, with state for the rows, the loading flag and the error, and a clean-up that
 * ignores a response that arrives after newer params have taken over.
 */
export function ResourceSearch({ selectedId, onSelectionChange, ref }: ResourceSearchProps) {
  const { unitOfWorkManager } = useServices();
  const saves = useSaveCount(unitOfWorkManager);

  /** What is in the box, as the user types. */
  const [text, setText] = useState('');
  /** The search that was run - with a counter, so running the same text again reloads. */
  const [query, setQuery] = useState({ text: '', run: 0 });

  /**
   * The search to run: the query, and how many saves there have been.  A new key means "load".
   */
  const key = `${query.run}:${saves}`;

  /**
   * The last result: which search it answered, its rows and its error.  "Loading" is not kept as
   * state of its own but *derived*: the pane is loading while the result is for an older key.
   * Deriving rather than syncing state is a React habit worth having - the effect below then only
   * sets state when the answer arrives, never at its start.
   */
  const [result, setResult] = useState<{
    key: string | null;
    rows: StaffingResourceListItem[];
    error: unknown;
  }>({ key: null, rows: [], error: null });

  const loading = result.key !== key;
  const rows = result.rows;
  const error = result.error;

  /** Runs the search for `searchText`. */
  function runSearch(searchText: string): void {
    setQuery((current) => ({ text: searchText.trim(), run: current.run + 1 }));
  }

  useImperativeHandle(ref, () => ({
    searchFor(searchText: string) {
      setText(searchText);
      runSearch(searchText);
    },
  }));

  /**
   * Port of the last line of `Search(Guid selection)`: when new results arrive and the workspace's
   * resource is not among them, select the first row.  That is what opens the workspace on the
   * first resource, and what moves the selection on after a delete.  If the open resource is in the
   * results, the selection is left alone, so a save - which reloads this list - does not trigger a
   * second detail load.
   *
   * An effect event, because it reads the latest `selectedId` and calls the latest callback without
   * those being reasons to run it.
   */
  const selectIfMissing = useEffectEvent((results: StaffingResourceListItem[]) => {
    if (!results.some((row) => row.id === selectedId)) {
      onSelectionChange(results[0] ?? null);
    }
  });

  // Load the results when a search runs and after every save anywhere.
  useEffect(() => {
    let current = true;

    unitOfWorkManager
      .get(SHARED_UNIT_OF_WORK_KEY)
      .search(query.text)
      .then(
        (results) => {
          if (current) {
            // The previous rows stay on screen until these arrive - the Angular `linkedSignal`.
            setResult({ key, rows: results, error: null });
            selectIfMissing(results);
          }
        },
        (failure: unknown) => {
          if (current) {
            setResult((previous) => ({ key, rows: previous.rows, error: failure }));
          }
        },
      );

    // The clean-up: a newer search, or unmounting, makes this response stale.
    return () => {
      current = false;
    };
  }, [key, query.text, unitOfWorkManager]);

  /** Port of `CanSearch` / `CanClear`. */
  const canSearch = !!text.trim();

  return (
    <div className="search">
      <form
        className="search__bar"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSearch) {
            runSearch(text);
          }
        }}
      >
        <TextInput
          className="search__text"
          type="search"
          placeholder="Search staffing resources"
          aria-label="Search staffing resources"
          value={text}
          onChange={(event) => setText(event.currentTarget.value)}
        />
        <Button type="submit" disabled={!canSearch}>
          Search
        </Button>
        <Button
          variant="outline"
          color="gray"
          disabled={!canSearch}
          onClick={() => {
            setText('');
            runSearch('');
          }}
        >
          Clear
        </Button>
        {loading && <Loader size="sm" aria-label="Please wait" />}
      </form>

      {error !== null && (
        <p className="search__error" role="alert">
          {describe(error).detail}
        </p>
      )}

      <ScrollArea.Autosize mah="14rem" className="search__grid">
        <Table className="search__table" stickyHeader verticalSpacing={6}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Address 1</Table.Th>
              <Table.Th>City</Table.Th>
              <Table.Th>State</Table.Th>
              <Table.Th>Zipcode</Table.Th>
              <Table.Th>Phone</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6} className="search__empty">
                  No staffing resources matched.
                </Table.Td>
              </Table.Tr>
            ) : (
              rows.map((item) => (
                <Table.Tr
                  key={item.id}
                  data-selected={item.id === selectedId || undefined}
                  aria-selected={item.id === selectedId}
                  onClick={() => onSelectionChange(item)}
                >
                  <Table.Td>{item.fullName}</Table.Td>
                  <Table.Td>{item.address1}</Table.Td>
                  <Table.Td>{item.city}</Table.Td>
                  <Table.Td>{item.state}</Table.Td>
                  <Table.Td>{item.zipcode}</Table.Td>
                  <Table.Td>{item.phoneNumber}</Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea.Autosize>
    </div>
  );
}
