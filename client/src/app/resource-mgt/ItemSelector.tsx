import { Button, Group, Select, Stack } from '@mantine/core';
import { useState } from 'react';

import { CloseDialog } from '../core/services/dialog.service';

interface ItemSelectorProps<T extends { id: string }> {
  /** Prompt shown above the list - the original passed "Select type:". */
  prompt: string;
  items: readonly T[];
  /** What to show for each item - its `displayName` for address and rate types, `name` for phones. */
  label: (item: T) => string;
  onClose: CloseDialog<T>;
}

/**
 * A tiny reusable "pick one of these" dialog, used when adding an address, a phone number or a rate
 * to choose its type.
 *
 * Port of the Angular client's `resource-mgt/item-selector.component.ts` (and before it of
 * `ItemSelectorViewModel.cs`).  The Angular version took the name of the property to display as a
 * string (`displayProperty: 'displayName'`); a function, `label`, does the same job here and is
 * checked by the compiler.  The component is **generic**: `T` is the item type, so the dialog
 * resolves with an `AddressType` when given address types.
 */
export function ItemSelector<T extends { id: string }>({
  prompt,
  items,
  label,
  onClose,
}: ItemSelectorProps<T>) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((item) => item.id === selectedId);

  return (
    <Stack gap="md">
      <Select
        label={prompt}
        placeholder="Select..."
        data={items.map((item) => ({ value: item.id, label: label(item) }))}
        value={selectedId}
        onChange={setSelectedId}
        comboboxProps={{ withinPortal: true }}
        data-autofocus
      />
      <Group justify="flex-end" gap="xs">
        <Button disabled={!selected} onClick={() => onClose(selected)}>
          OK
        </Button>
        <Button variant="outline" color="gray" onClick={() => onClose(undefined)}>
          Cancel
        </Button>
      </Group>
    </Stack>
  );
}
