import { Button, HeaderRow, HeaderText, SectionSubtitle, SectionTitle, UserMenu } from '../../../components/ui';
import { spacing } from '../../../styles/tokens';

type BudgetPageHeaderProps = {
  onOpenBudgetModal: () => void;
};

export const BudgetPageHeader = ({ onOpenBudgetModal }: BudgetPageHeaderProps): JSX.Element => {
  return (
    <HeaderRow>
      <HeaderText>
        <SectionTitle>Budget &amp; Forecast</SectionTitle>
        <SectionSubtitle>Track your budget, monitor spending, and forecast future balance.</SectionSubtitle>
      </HeaderText>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' }}>
        <Button type="button" $variant="accent" $weight="semibold" $elevation="accent" onClick={onOpenBudgetModal}>
          + Set budget
        </Button>
        <UserMenu />
      </div>
    </HeaderRow>
  );
};
