import { JoinScreen } from '@/features/game/session-entry/JoinScreen/JoinScreen';

interface JoinPageProps {
  params: Promise<{ code: string }>;
}

export default async function JoinPage({ params }: JoinPageProps) {
  const { code } = await params;
  return <JoinScreen initialCode={code} />;
}
