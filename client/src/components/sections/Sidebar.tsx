import { LayoutDashboard, Users, Upload, type LucideIcon } from 'lucide-react';
import styled from 'styled-components';
import { colors, radii, spacing } from '../../styles/tokens';

const Aside = styled.aside`
  padding: ${spacing.xl} 14px;
  border-right: 1px solid ${colors.border};
  background: ${colors.sidebarBg};

  @media (max-width: 900px) {
    border-right: 0;
    border-bottom: 1px solid ${colors.border};
  }
`;

const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const BrandIcon = styled.div`
  width: 28px;
  height: 28px;
  border-radius: ${radii.full};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: ${colors.surface};
  background: linear-gradient(135deg, #5b4ef4, #4131d4);
  box-shadow: 0 6px 12px rgba(67, 56, 202, 0.25);
`;

const BrandText = styled.div`
  h2 {
    margin: 0;
    font-size: 26px;
    line-height: 1;
    color: ${colors.textPrimary};
  }

  p {
    margin: 2px 0 0;
    color: ${colors.textSubtle};
    font-size: 11px;
    text-transform: lowercase;
  }

  @media (max-width: 900px) {
    h2 {
      font-size: 22px;
    }
  }
`;

const Nav = styled.nav`
  margin-top: ${spacing.xxl};
`;

const NavList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${spacing.xs};
`;

const NavButton = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  border: 0;
  border-radius: ${radii.sm};
  padding: 9px 10px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 120ms ease, color 120ms ease;
  background: ${({ $active }) => ($active ? colors.sidebarActiveBg : 'transparent')};
  color: ${({ $active }) => ($active ? colors.sidebarActiveText : '#374151')};

  &:hover {
    background: ${({ $active }) => ($active ? colors.sidebarActiveBg : colors.background)};
  }
`;

const NavIcon = styled.span`
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: currentColor;
  flex-shrink: 0;

  svg {
    width: 16px;
    height: 16px;
    display: block;
  }
`;

type NavItem = {
  label: string;
  Icon: LucideIcon;
};

const navItems: NavItem[] = [
  { label: 'Dashboard', Icon: LayoutDashboard },
  { label: 'Groups', Icon: Users },
  { label: 'Import Statement', Icon: Upload },
];

export const Sidebar = (): JSX.Element => {
  return (
    <Aside>
      <Brand>
        <BrandIcon aria-hidden>B</BrandIcon>
        <BrandText>
          <h2>BudgetShare</h2>
          <p>Household budgeting</p>
        </BrandText>
      </Brand>

      <Nav>
        <NavList>
          {navItems.map((item, index) => (
            <li key={item.label}>
              <NavButton type="button" aria-current={index === 0 ? 'page' : undefined} $active={index === 0}>
                <NavIcon aria-hidden>
                  <item.Icon size={12} strokeWidth={2} />
                </NavIcon>
                <span>{item.label}</span>
              </NavButton>
            </li>
          ))}
        </NavList>
      </Nav>
    </Aside>
  );
};
