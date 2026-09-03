import ProjectDetailClient from "./ProjectDetailClient";

export default function ProjectDetailPage({
  params,
}: {
  params: { workspaceId: string; projectId: string };
}) {
  return (
    <ProjectDetailClient
      workspaceId={params.workspaceId}
      projectId={params.projectId}
    />
  );
}
