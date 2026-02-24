import AnnouncementsIndex from '@/pages/announcements/index';
import SuperAccountingLayout from '@/layouts/super-accounting/super-accounting-layout';

(AnnouncementsIndex as any).layout = (page: React.ReactElement) => <SuperAccountingLayout>{page}</SuperAccountingLayout>;

export default AnnouncementsIndex;
