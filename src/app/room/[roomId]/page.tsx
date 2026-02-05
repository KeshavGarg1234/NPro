import RoomClient from '@/components/synctube/room-client';

type RoomPageProps = {
  params: Promise<{
    roomId: string;
  }>;
};

export default async function RoomPage({ params }: RoomPageProps) {
  const { roomId } = await params;
  return <RoomClient roomId={roomId} />;
}
