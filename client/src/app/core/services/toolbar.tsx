import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';

/**
 * Port of `Common/Toolbar/ToolbarAction.cs`, by way of the Angular client.
 *
 * Angular's version carried a `canExecute` thunk that read signals, so the toolbar re-evaluated it
 * by itself.  In React the screen that owns an action works out `disabled` while it renders and
 * registers the group again, so the toolbar always shows the latest - see `useToolbarGroup`.
 */
export interface ToolbarAction {
  label: string;
  icon?: ReactNode;
  execute: () => void;
  disabled?: boolean;
}

/** Port of `Common/Toolbar/ToolbarGroup`.  `level` controls left-to-right ordering. */
export interface ToolbarGroup {
  level: number;
  actions: ToolbarAction[];
}

/** Flattens groups into one action list, ordered by group level. */
export function toolbarActions(groups: readonly ToolbarGroup[]): ToolbarAction[] {
  return [...groups].sort((a, b) => a.level - b.level).flatMap((group) => group.actions);
}

type SetGroup = (id: string, group: ToolbarGroup | null) => void;

/**
 * Two contexts, not one, on purpose.  The groups change whenever a screen's commands do; the setter
 * never changes.  A screen only needs the setter, so it reads that context alone, and does not
 * render again every time the toolbar does - which, since registering a group changes the groups,
 * would otherwise go round in a loop.
 */
const GroupsContext = createContext<readonly ToolbarGroup[]>([]);
const SetGroupContext = createContext<SetGroup>(() => {});

/**
 * Port of `Common/Toolbar/IToolbarManager.cs` + `ToolbarManager.cs`, by way of the Angular
 * client's `ToolbarService`: holds the groups contributed by the active screen.  The shell combines
 * them with its own groups (see `App`).
 */
export function ToolbarProvider({ children }: { children: ReactNode }) {
  const [groups, setGroups] = useState<ReadonlyMap<string, ToolbarGroup>>(new Map());

  // `useCallback` keeps the same function across renders, so the setter context never changes.
  const setGroup = useCallback<SetGroup>((id, group) => {
    setGroups((current) => {
      const next = new Map(current);
      if (group) {
        next.set(id, group);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const list = useMemo(() => [...groups.values()], [groups]);

  return (
    <SetGroupContext value={setGroup}>
      <GroupsContext value={list}>{children}</GroupsContext>
    </SetGroupContext>
  );
}

/** The groups contributed by screens. */
export function useToolbarGroups(): readonly ToolbarGroup[] {
  return useContext(GroupsContext);
}

/**
 * Shows `group` in the toolbar for as long as the calling component is mounted, kept up to date as
 * the component re-renders with new commands or new `disabled` states.
 *
 * The counterpart of Angular's `registerToolbarGroup`, which added the group in the constructor and
 * removed it through `DestroyRef`.  React has no constructor or destroy hook; it has **effects**.
 * `useEffect(fn, deps)` runs `fn` after the component has rendered, and again whenever a value in
 * `deps` changed since the last render; the function `fn` returns is the clean-up, run before the
 * next run and when the component unmounts.  So the first effect below re-registers the group after
 * every render that produced a new one, and the second removes it on unmount.
 */
export function useToolbarGroup(group: ToolbarGroup): void {
  const setGroup = useContext(SetGroupContext);
  const id = useId();

  useEffect(() => {
    setGroup(id, group);
  }, [id, group, setGroup]);

  useEffect(() => () => setGroup(id, null), [id, setGroup]);
}
