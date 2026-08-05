import { notFound } from 'next/navigation';
import { fetchRecommendationDetail } from '@/lib/api';
import { RecommendationDetails } from '@/components/RecommendationDetails';

interface Props {
  params: { id: string };
}

export default async function RecommendationDetailPage({ params }: Props) {
  let detail;
  try {
    detail = await fetchRecommendationDetail(params.id);
  } catch {
    notFound();
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '48px 16px 32px',
      }}
    >
      <RecommendationDetails detail={detail} />
    </main>
  );
}
