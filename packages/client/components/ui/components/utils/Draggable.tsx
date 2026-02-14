import { dndzone } from "solid-dnd-directive";
import {
  Accessor,
  For,
  JSX,
  Setter,
  createEffect,
  createSignal,
  onCleanup,
} from "solid-js";

/** Duration in ms a touch must be held before drag activates */
const LONG_PRESS_DELAY_MS = 500;

/** Max movement in px before a touch is considered a scroll, not a long press */
const LONG_PRESS_MOVE_THRESHOLD_PX = 10;

interface Props<T> {
  type?: string;
  items: Item<T>[];
  disabled?: boolean;
  dragHandles?: boolean;
  children: (item: {
    item: T;
    dragDisabled: Accessor<boolean>;
    setDragDisabled: Setter<boolean>;
  }) => JSX.Element;
  onChange: (ids: string[]) => void;
  minimumDropAreaHeight?: string;
}

type Item<T> = { id: string } & T;

/**
 * The dnd zone library requires you to have an id key
 */
interface ContainerItem<T> {
  id: string;
  item: T;
}

interface DragHandleEvent<T> {
  detail: {
    items: ContainerItem<T>[];
  };
  type: "consider" | "finalize";
}

/**
 * Typescript removes dndzone because it thinks that it is not being used.
 * This trick prevents that from happening.
 * https://github.com/solidjs/solid/issues/1005#issuecomment-1134778606
 */
void dndzone;

/**
 * Draggable list container
 */
export function Draggable<T>(props: Props<T>) {
  const [dragDisabled, setDragDisabled] = createSignal(
    // eslint-disable-next-line solid/reactivity
    props.dragHandles || false,
  );

  // On touch devices, block drag until a long-press is detected.
  // This prevents drag from hijacking normal scroll gestures.
  const [touchDragBlocked, setTouchDragBlocked] = createSignal(false);

  const [containerItems, setContainerItems] = createSignal<ContainerItem<T>[]>(
    [],
  );

  createEffect(() => setDragDisabled(props.dragHandles || false));

  createEffect(() => {
    const newContainerItems = props.items.map((item) => ({
      id: item.id,
      item,
    }));

    setContainerItems(newContainerItems);
  });

  // Long-press timer state for touch drag activation
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let touchStartX = 0;
  let touchStartY = 0;

  function clearLongPressTimer() {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function handleTouchStart(e: TouchEvent) {
    if (props.disabled) return;

    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;

    // Block drag during the long-press detection period
    setTouchDragBlocked(true);

    clearLongPressTimer();
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      // Long press detected -- unblock drag
      setTouchDragBlocked(false);

      // Haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, LONG_PRESS_DELAY_MS);
  }

  function handleTouchMove(e: TouchEvent) {
    if (longPressTimer === null) return;

    const touch = e.touches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;

    // If finger moved beyond threshold, user is scrolling -- cancel long press
    if (Math.abs(dx) > LONG_PRESS_MOVE_THRESHOLD_PX || Math.abs(dy) > LONG_PRESS_MOVE_THRESHOLD_PX) {
      clearLongPressTimer();
      // Keep drag blocked so scroll continues unimpeded
      setTouchDragBlocked(true);
    }
  }

  function handleTouchEnd() {
    clearLongPressTimer();
    // Re-allow normal drag state after touch ends
    setTouchDragBlocked(false);
  }

  onCleanup(() => clearLongPressTimer());

  /**
   * Handle DND event from solid-dnd-directive
   * @param e
   */
  function handleDndEvent(e: DragHandleEvent<T>) {
    setDragDisabled(props.dragHandles || false);
    setTouchDragBlocked(false);

    const { items: newContainerItems } = e.detail;
    setContainerItems(newContainerItems);

    if (e.type === "finalize") {
      props.onChange(
        newContainerItems.map((containerItems) => containerItems.id),
      );
    }
  }

  function isDisabled() {
    return props.disabled || dragDisabled() || touchDragBlocked();
  }

  return (
    <div
      ontouchstart={handleTouchStart}
      ontouchmove={handleTouchMove}
      ontouchend={handleTouchEnd}
      ontouchcancel={handleTouchEnd}
      use:dndzone={{
        type: props.type,
        items: containerItems,
        dragDisabled: isDisabled,
        flipDurationMs: 0,
        // transformDraggedElement: (el?: HTMLElement) => {
        //   if (el) {
        //     el.style.cursor = "grabbing !important";
        //     el.style.outline = "1px solid red";
        //   }
        // },
        dropTargetStyle: {
          outline:
            "2px solid color-mix(in srgb, 40% var(--md-sys-color-primary), transparent)",
          borderRadius: "4px",
          outlineOffset: "-2px",
          minHeight: "24px",
        },
      }}
      // @ts-expect-error missing jsx typing
      on:consider={handleDndEvent}
      on:finalize={handleDndEvent}
    >
      <For each={containerItems()}>
        {(containerItem) =>
          props.children({
            item: containerItem.item,
            dragDisabled,
            setDragDisabled,
          })
        }
      </For>
    </div>
  );
}

export function createDragHandle(
  dragDisabled: Accessor<boolean>,
  setDragDisabled: Setter<boolean>,
) {
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let handleTouchStartX = 0;
  let handleTouchStartY = 0;

  function clearTimer() {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function startDrag(e: Event) {
    e.preventDefault();
    setDragDisabled(false);
  }

  function endDrag() {
    clearTimer();
    setDragDisabled(true);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if ((e.key === "Enter" || e.key === " ") && dragDisabled())
      setDragDisabled(false);
  }

  function handleTouchStart(e: TouchEvent) {
    const touch = e.touches[0];
    handleTouchStartX = touch.clientX;
    handleTouchStartY = touch.clientY;

    clearTimer();
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      // Long press detected on drag handle -- enable drag
      setDragDisabled(false);
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, LONG_PRESS_DELAY_MS);
  }

  function handleTouchMove(e: TouchEvent) {
    if (longPressTimer === null) return;

    const touch = e.touches[0];
    const dx = touch.clientX - handleTouchStartX;
    const dy = touch.clientY - handleTouchStartY;

    if (Math.abs(dx) > LONG_PRESS_MOVE_THRESHOLD_PX || Math.abs(dy) > LONG_PRESS_MOVE_THRESHOLD_PX) {
      clearTimer();
      // User is scrolling, keep drag disabled
      setDragDisabled(true);
    }
  }

  function handleTouchEnd() {
    clearTimer();
  }

  return {
    tabindex: dragDisabled() ? 0 : -1,
    onmouseenter: startDrag,
    ontouchstart: handleTouchStart,
    ontouchmove: handleTouchMove,
    ontouchend: handleTouchEnd,
    ontouchcancel: handleTouchEnd,
    onmouseleave: endDrag,
    onkeydown: handleKeyDown,
    "aria-label": "drag-handle",
  };
}
