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

export const GroupsPage = (): JSX.Element => {
  return (
    <AppLayout>
      <Sidebar />
      <PageSurface>
        <HeaderRow>
          <HeaderText>
            <SectionTitle>Groups</SectionTitle>
            <SectionSubtitle>Manage members and default split ratios.</SectionSubtitle>
          </HeaderText>
        </HeaderRow>
        <MutedText>Groups page scaffold is ready. Next: list cards and create-group modal.</MutedText>
      </PageSurface>
    </AppLayout>
  );
};
