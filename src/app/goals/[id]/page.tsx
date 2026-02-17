import GoalEditor from "./goal-editor";

export default async function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GoalEditor goalId={id} />;
}
