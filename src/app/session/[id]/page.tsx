import { SessionApp } from '@/features/game/session-client/SessionApp/SessionApp';

interface SessionPageProps {
  params: Promise<{ id: string }>;
}

export default async function SessionPage({ params }: SessionPageProps) {
  const { id } = await params;
  return <SessionApp sessionId={id} />;
}
