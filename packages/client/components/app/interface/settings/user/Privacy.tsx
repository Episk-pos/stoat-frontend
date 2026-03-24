import { Trans } from "@lingui-solid/solid/macro";

import { useClient } from "@revolt/client";
import { CategoryButton, CategoryButtonGroup, Checkbox, Column } from "@revolt/ui";

/**
 * Privacy settings
 */
export default function PrivacySettings() {
  const client = useClient();

  return (
    <Column gap="xl">
      <CategoryButtonGroup>
        <CategoryButton
          action={
            <Checkbox
              checked={client().user?.friendOnlyDms}
              onChange={(event) => {
                client().user?.edit({
                  friend_only_dms: event.currentTarget.checked,
                } as any);
              }}
            />
          }
          description={
            <Trans>
              When enabled, only users on your friends list can send you direct
              messages.
            </Trans>
          }
          onClick={() => void 0}
        >
          <Trans>Only allow direct messages from friends</Trans>
        </CategoryButton>
      </CategoryButtonGroup>
    </Column>
  );
}
