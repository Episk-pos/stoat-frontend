import { Trans } from "@lingui-solid/solid/macro";
import { useMutation } from "@tanstack/solid-query";

import { Dialog, DialogProps } from "@revolt/ui";

import { useModals } from "..";
import { Modals } from "../types";

/**
 * Modal to delete a scheduled event
 */
export function DeleteScheduledEventModal(
  props: DialogProps & Modals & { type: "delete_scheduled_event" },
) {
  const { showError } = useModals();

  const deleteEvent = useMutation(() => ({
    mutationFn: async () => {
      await props.event.delete();
      props.cb();
    },
    onError: showError,
  }));

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Delete {props.event.name}?</Trans>}
      actions={[
        { text: <Trans>Cancel</Trans> },
        {
          text: <Trans>Delete</Trans>,
          onClick: () => deleteEvent.mutateAsync(),
        },
      ]}
      isDisabled={deleteEvent.isPending}
    >
      <Trans>Once it's deleted, there's no going back.</Trans>
    </Dialog>
  );
}
