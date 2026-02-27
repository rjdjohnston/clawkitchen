"use client";

import { DeleteEntityModal } from "./DeleteEntityModal";

type EntityLabelKey = "agentId" | "teamId" | "recipeId" | "jobLabel";

type BaseProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  busy?: boolean;
  error?: string | null;
};

function createDeleteModal<K extends EntityLabelKey>(config: {
  title: string;
  bodyText: string;
  entityLabelKey: K;
}) {
  return function DeleteModal(props: BaseProps & Record<K, string>) {
    const entityLabel = props[config.entityLabelKey];
    return (
      <DeleteEntityModal
        open={props.open}
        onClose={props.onClose}
        title={config.title}
        entityLabel={entityLabel}
        bodyText={config.bodyText}
        onConfirm={props.onConfirm}
        busy={props.busy}
        error={props.error}
      />
    );
  };
}

export const DeleteAgentModal = createDeleteModal({
  title: "Delete agent",
  bodyText: "This will remove its workspace/state.",
  entityLabelKey: "agentId",
});

export const DeleteTeamModal = createDeleteModal({
  title: "Delete Team",
  bodyText: "This will remove the team workspace, agents, and stamped cron jobs.",
  entityLabelKey: "teamId",
});

export const DeleteRecipeModal = createDeleteModal({
  title: "Delete recipe",
  bodyText: "This removes the markdown file from your workspace.",
  entityLabelKey: "recipeId",
});

export const DeleteCronJobModal = createDeleteModal({
  title: "Delete cron job",
  bodyText: "This removes it from the Gateway scheduler. You can recreate it later.",
  entityLabelKey: "jobLabel",
});
