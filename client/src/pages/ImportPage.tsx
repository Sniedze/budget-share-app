import { Sidebar } from '../components/sections';
import {
  AppLayout,
  HeaderRow,
  HeaderText,
  MutedText,
  PageSurface,
  SectionSubtitle,
  SectionTitle,
} from '../components/ui';

export const ImportPage = (): JSX.Element => {
  return (
    <AppLayout>
      <Sidebar />
      <PageSurface>
        <HeaderRow>
          <HeaderText>
            <SectionTitle>Import Statement</SectionTitle>
            <SectionSubtitle>Import bank statement files and map transactions.</SectionSubtitle>
          </HeaderText>
        </HeaderRow>
        <MutedText>Import page scaffold is ready. Next: upload and parsing flow.</MutedText>
      </PageSurface>
    </AppLayout>
  );
};
